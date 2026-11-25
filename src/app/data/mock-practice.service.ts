import { Injectable, inject } from '@angular/core';
import { map, Observable, of, switchMap } from 'rxjs';
import { GameHistoryService } from './game-history.service';
import type { GameHistoryDto } from './game-history.model';
import { PracticePoolService } from './practice-pool.service';
import { PracticeService } from './practice.service';
import { DEFAULT_PRACTICE_PREFERENCES, type DailyPracticeSession, type PracticePreferences, type StreakInfo } from './practice.model';
import type { ExerciseProgress } from '../exercise/exercise-state';
import { SgfParserService } from '../sgf/sgf-parser.service';
import { cloneSession, newSessionId, pickExercises, todayIso } from './practice-exercise-picker';

const STORAGE_KEY = 'kz-practice-sessions';

/**
 * Session-local Daily Practice backend, no network for the sessions
 * themselves (the practice-pool is the one real HTTP fetch — see
 * PracticePoolService) — built on top of whichever GameHistoryService is
 * configured (the real mock fixtures in dev), so exercises are picked the
 * same way a real backend would: from analysed games' phase SGFs that
 * actually have a usable branch point (buildExerciseTree doesn't throw).
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
  private readonly practicePool = inject(PracticePoolService);

  private sessions: DailyPracticeSession[] = loadSessions();
  private preferences: PracticePreferences = { ...DEFAULT_PRACTICE_PREFERENCES };

  getTodaySession(): Observable<DailyPracticeSession | null> {
    const session = this.findDailySession(todayIso());
    return of(session ? cloneSession(session) : null);
  }

  startTodaySession(): Observable<DailyPracticeSession> {
    const existing = this.findDailySession(todayIso());
    if (existing) return of(cloneSession(existing));

    return this.gameHistory.listGames().pipe(
      switchMap((dtos) => this.candidatePool(dtos)),
      map((candidates) => {
        const exercises = pickExercises(this.sgfParser, candidates, {
          count: this.preferences.exerciseCount,
          topVariants: this.preferences.topVariants,
          continuationDepth: this.preferences.continuationDepth,
        });
        return this.upsertSession({
          id: newSessionId(),
          kind: 'daily',
          date: todayIso(),
          exercises,
          completed: exercises.length === 0,
        });
      }),
    );
  }

  /**
   * "Continue practicing" (shown once today's daily session is already
   * complete) — an *optional extra* round for a chat that wants to keep
   * practicing, not a replacement of the original: per
   * docs/backend-contract/daily-practice-endpoint-proposal.md, this must
   * never touch the one daily_session_db row the streak reads, so (like
   * startRandomPractice) it always adds a brand new `kind: 'generated'`
   * session rather than replacing today's daily one. Unlike
   * startRandomPractice, it draws from the chat's own games (shuffled), not
   * the bundled pool.
   */
  startNewRound(): Observable<DailyPracticeSession> {
    return this.gameHistory.listGames().pipe(
      switchMap((dtos) => this.candidatePool(dtos)),
      map((candidates) => {
        const exercises = pickExercises(this.sgfParser, candidates, {
          count: this.preferences.exerciseCount,
          shuffled: true,
          topVariants: this.preferences.topVariants,
          continuationDepth: this.preferences.continuationDepth,
        });
        return this.upsertSession({ id: newSessionId(), kind: 'generated', date: todayIso(), exercises, completed: exercises.length === 0 });
      }),
    );
  }

  /**
   * "Random practice" — ignores the chat's own games and the exerciseSource
   * preference entirely: the whole session comes from the bundled
   * practice-pool. Unlike startTodaySession/startNewRound, this always adds
   * a brand new `kind: 'generated'` session rather than replacing anything —
   * the chat can have any number of these alongside the one daily session,
   * and none of them affect the streak (see getStreak()).
   */
  startRandomPractice(count: number): Observable<DailyPracticeSession> {
    return this.practicePool.pool$.pipe(
      map((pool) => {
        const exercises = pickExercises(this.sgfParser, pool, {
          count,
          shuffled: true,
          topVariants: this.preferences.topVariants,
          continuationDepth: this.preferences.continuationDepth,
        });
        return this.upsertSession({ id: newSessionId(), kind: 'generated', date: todayIso(), exercises, completed: exercises.length === 0 });
      }),
    );
  }

  /** Newest first, so a freshly-generated session (or today's daily one, once it exists) leads the list. */
  listSessions(): Observable<DailyPracticeSession[]> {
    return of([...this.sessions].reverse().map(cloneSession));
  }

  getSession(sessionId: string): Observable<DailyPracticeSession | null> {
    const session = this.sessions.find((s) => s.id === sessionId);
    return of(session ? cloneSession(session) : null);
  }

  /**
   * 'own' (default): just the chat's own games. 'mixed': the chat's own games
   * first, padded with the practice-pool so a thin own-games pool still
   * fills a session.
   */
  private candidatePool(dtos: GameHistoryDto[]): Observable<GameHistoryDto[]> {
    if (this.preferences.exerciseSource !== 'mixed') return of(dtos);
    return this.practicePool.pool$.pipe(map((pool) => [...dtos, ...pool]));
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

  saveProgress(sessionId: string, exerciseId: string, progress: ExerciseProgress): Observable<void> {
    const session = this.sessions.find((s) => s.id === sessionId);
    const exercise = session?.exercises.find((e) => e.id === exerciseId);
    if (exercise) {
      exercise.selectedVariant = progress.selectedVariant;
      exercise.step = progress.step;
      exercise.currentDepth = progress.currentDepth;
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

  /** Only the daily session's own completion history counts — generated ("Random practice") sessions never affect the streak. No real multi-day persistence in the mock either, just today's daily session. */
  getStreak(): Observable<StreakInfo> {
    const doneToday = this.findDailySession(todayIso())?.completed ?? false;
    return of({ currentStreak: doneToday ? 1 : 0, last7Days: [false, false, false, false, false, false, doneToday] });
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

function loadSessions(): DailyPracticeSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DailyPracticeSession[]) : [];
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
