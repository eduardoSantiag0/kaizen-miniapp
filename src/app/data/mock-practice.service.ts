import { Injectable, inject } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { GameHistoryService } from './game-history.service';
import { PracticeService } from './practice.service';
import { readPracticePosition, writePracticeLocal } from './practice-local';
import { DEFAULT_PRACTICE_PREFERENCES, type DailyPracticeSession, PracticeSessionPage, type PracticePreferences, type PracticeSessionKind, type StreakInfo } from './practice.model';
import { SgfParserService } from '../sgf/sgf-parser.service';
import { asCandidates, cloneSession, PRACTICE_TIME_ZONE, newSessionId, pickExercises, todayIso } from './practice-exercise-picker';

const STREAK_STRIP_DAYS = 7;

const STORAGE_KEY = 'kz-practice-sessions';

/**
 * Session-local Daily Practice backend, no network at all for the sessions
 * themselves — built on top of whichever GameHistoryService is configured
 * (the real mock fixtures in dev), so exercises are picked the same way a
 * real backend would: from analysed games' phase SGFs that actually have a
 * usable branch point (buildExerciseTree doesn't throw). There is no local
 * stand-in for the real backend's shared public pool (kaizan-companion's
 * ExerciseOrigin.PUBLIC) — 'mixed' exerciseSource and "Random practice" both
 * just reuse the chat's own (real + synthetic) games here instead; every
 * exercise this produces is tagged origin: 'personal'. See HttpPracticeService
 * for the real integration, where 'dataset' actually means something.
 *
 * Sessions persist to localStorage (not just an in-memory field) so a page
 * reload doesn't lose a "Random practice" round the chat hasn't finished
 * yet — there is no real backend persistence here, see
 * docs/backend-contract/daily-practice-endpoint-proposal.md; this is purely
 * a frontend-dev stand-in for it.
 */
@Injectable()
export class MockPracticeService extends PracticeService {
  private readonly gameHistory = inject(GameHistoryService);
  private readonly sgfParser = inject(SgfParserService);

  private sessions: DailyPracticeSession[] = loadSessions();
  private preferences: PracticePreferences = { ...DEFAULT_PRACTICE_PREFERENCES };

  getTodaySession(): Observable<DailyPracticeSession | null> {
    const session = this.findDailySession(todayIso());
    return of(session ? cloneSession(session) : null);
  }

  startTodaySession(): Observable<DailyPracticeSession> {
    const existing = this.findDailySession(todayIso());
    if (existing) return of(cloneSession(existing));

    return this.sessionFromOwnGames('daily', this.preferences.exerciseCount, false);
  }

  /**
   * "Continue practicing" (shown once today's daily session is already
   * complete) — an *optional extra* round for a chat that wants to keep
   * practicing, not a replacement of the original: per
   * docs/backend-contract/daily-practice-endpoint-proposal.md, this must
   * never touch the one daily_session_db row the streak reads, so (like
   * startRandomPractice) it always adds a brand new `kind: 'generated'`
   * session rather than replacing today's daily one.
   */
  startNewRound(): Observable<DailyPracticeSession> {
    return this.sessionFromOwnGames('generated', this.preferences.exerciseCount, true);
  }

  /**
   * "Random practice" — always adds a brand new `kind: 'generated'` session
   * rather than replacing anything — the chat can have any number of these
   * alongside the one daily session, and none of them affect the streak (see
   * getStreak()). `count` comes from the dialog, independent of the
   * exerciseCount preference. See this class's own doc comment: no distinct
   * pool exists in the mock, so this draws from the same own/synthetic games
   * startNewRound does — HttpPracticeService is where this actually differs.
   */
  startRandomPractice(count: number): Observable<DailyPracticeSession> {
    return this.sessionFromOwnGames('generated', count, true);
  }

  private sessionFromOwnGames(kind: PracticeSessionKind, count: number, shuffled: boolean): Observable<DailyPracticeSession> {
    return this.gameHistory.listGames().pipe(
      map((dtos) => {
        const exercises = pickExercises(this.sgfParser, asCandidates(dtos, 'personal'), {
          count,
          shuffled,
          topVariants: this.preferences.topVariants,
          continuationDepth: this.preferences.continuationDepth,
        });
        return this.upsertSession({ id: newSessionId(), kind, date: todayIso(), exercises, completed: exercises.length === 0 });
      }),
    );
  }

  /** Newest first, so a freshly-generated session (or today's daily one, once it exists) leads the list. */
  listSessions(page = 0, size = 20, kind?: PracticeSessionKind): Observable<PracticeSessionPage> {
    const sessions = this.sessions.filter((session) => !kind || session.kind === kind).reverse();
    const start = page * size;
    return of({
      sessions: sessions.slice(start, start + size).map(({ id, kind, date, completed, exercises }) => ({
        id, kind, date, completed,
        exerciseCount: exercises.length,
        completedCount: exercises.filter((exercise) => exercise.completed).length,
      })),
      nextPage: start + size < sessions.length ? page + 1 : null,
    });
  }

  getSession(sessionId: string): Observable<DailyPracticeSession | null> {
    const session = this.sessions.find((s) => s.id === sessionId);
    return of(session ? cloneSession(session) : null);
  }

  recordResult(sessionId: string, exerciseId: string): Observable<void> {
    const session = this.sessions.find((s) => s.id === sessionId);
    const exercise = session?.exercises.find((e) => e.id === exerciseId);
    if (session && exercise) {
      exercise.completed = true;
      session.completed = session.exercises.every((e) => e.completed);
      this.persist();
    }
    return of(undefined);
  }


  getPreferences(): Observable<PracticePreferences> {
    return of({ ...this.preferences });
  }

  setPreferences(preferences: PracticePreferences): Observable<void> {
    this.preferences = { ...preferences };
    return of(undefined);
  }

  /**
   * Only the daily session's own completion history counts — generated
   * ("Random practice") sessions never affect the streak. Walks the actual
   * persisted 'daily' sessions by date rather than just checking today's:
   * currentStreak is the run of consecutive completed calendar days ending
   * today (if today's already done) or ending yesterday (if today isn't
   * finished yet — not practicing *yet* today doesn't reset a streak still
   * in progress, same semantics PracticeCompleteComponent's copy assumes:
   * "Finish today's practice to make it currentStreak + 1").
   */
  getStreak(): Observable<StreakInfo> {
    // A session with zero exercises (no analyzed games that day) is marked
    // `completed` trivially by startTodaySession (nothing to finish) — that
    // must not count as a practiced day, or the streak would climb on its
    // own for a chat that never actually practiced.
    const isDoneOn = (date: Date) => {
      const session = this.findDailySession(date.toISOString().slice(0, 10));
      return session?.completed === true && session.exercises.length > 0;
    };

    const date = todayIso();
    const today = new Date(`${date}T00:00:00Z`);

    let cursor = today;
    if (!isDoneOn(cursor)) cursor = addDays(cursor, -1);

    let currentStreak = 0;
    while (isDoneOn(cursor)) {
      currentStreak++;
      cursor = addDays(cursor, -1);
    }

    const last7Days: boolean[] = [];
    for (let i = STREAK_STRIP_DAYS - 1; i >= 0; i--) {
      last7Days.push(isDoneOn(addDays(today, -i)));
    }

    return of({ currentStreak, last7Days, date, timeZone: PRACTICE_TIME_ZONE });
  }

  private findDailySession(date: string): DailyPracticeSession | undefined {
    return this.sessions.find((s) => s.kind === 'daily' && s.date === date);
  }

  private upsertSession(session: DailyPracticeSession): DailyPracticeSession {
    const index = this.sessions.findIndex((s) => s.id === session.id);
    if (index === -1) this.sessions.push(session);
    else this.sessions[index] = session;
    this.persist();
    return cloneSession(session);
  }

  private persist(): void {
    saveSessions(this.sessions);
  }
}

function addDays(date: Date, delta: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + delta);
  return result;
}

function loadSessions(): DailyPracticeSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const sessions = JSON.parse(raw) as (Omit<DailyPracticeSession, 'exercises'> & {
      exercises: (DailyPracticeSession['exercises'][number] & {
        currentDepth?: number;
        selectedVariant?: number | null;
        step?: number;
      })[];
    })[];
    let migrated = false;
    for (const session of sessions) {
      for (const exercise of session.exercises) {
        const { currentDepth, selectedVariant, step } = exercise;
        if (currentDepth === undefined) continue;
        exercise.requiredDepth = currentDepth;
        if (selectedVariant != null && Number.isInteger(step) && step! >= 1 &&
            !readPracticePosition('standalone', session.id, exercise.id)) {
          writePracticeLocal('standalone', session.id, exercise.id, 'position', {
            selectedVariant, confirmedPlies: (step! - 1) * 2, currentDepth,
            progressPhase: 'playing', deepening: false,
          });
        }
        delete exercise.currentDepth;
        delete exercise.selectedVariant;
        delete exercise.step;
        migrated = true;
      }
    }
    if (migrated) saveSessions(sessions);
    return sessions;
  } catch {
    return []; // Corrupt/unavailable storage degrades to "no sessions yet", not a hard failure.
  }
}

function saveSessions(sessions: DailyPracticeSession[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Storage full/unavailable (e.g. private browsing) — sessions still work for this page load, just won't survive a reload.
  }
}
