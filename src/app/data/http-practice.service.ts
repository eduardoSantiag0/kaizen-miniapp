import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, finalize, map, Observable, of, shareReplay, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { TelegramService } from '../core/telegram.service';
import { PracticePoolService } from './practice-pool.service';
import { PracticeService } from './practice.service';
import type { ExerciseProgress } from '../exercise/exercise-state';
import type { DailyPracticeSession, PracticePreferences, StreakInfo } from './practice.model';
import { SgfParserService } from '../sgf/sgf-parser.service';
import { cloneSession, newSessionId, pickExercises } from './practice-exercise-picker';

/**
 * Real HTTP-backed PracticeService, per
 * docs/backend-contract/daily-practice-endpoint-proposal.md — no real
 * backend exists yet; this is the exact contract it should match. Unused in
 * app.config.ts until then (same environment.useRealBackend switch
 * GameHistoryService already uses).
 */
@Injectable()
export class HttpPracticeService extends PracticeService {
  private readonly http = inject(HttpClient);
  private readonly telegram = inject(TelegramService);
  private readonly practicePool = inject(PracticePoolService);
  private readonly sgfParser = inject(SgfParserService);

  private static readonly BASE = '/kaizan/api/v1/practice';

  /**
   * "Random practice" never touches the server at all — it's bundled
   * frontend test data (see startRandomPractice's own doc comment on
   * PracticeService), so these `kind: 'generated'` sessions live purely in
   * this field, never sent anywhere. Every other session (the one `kind:
   * 'daily'` session, and any `kind: 'generated'` one from "Continue
   * practicing"/startNewRound) is real server state — listSessions/
   * getSession below merge the two sources for the caller.
   */
  private localPoolSessions: DailyPracticeSession[] = [];

  /**
   * At least 4 components call startTodaySession() independently on their own mount
   * (the Games row, its card, Daily Practice Home, the completion screen) — without
   * this, each one fires its own POST, wasting requests and, in a race, risking one of
   * them hitting the backend's unique-session-per-day constraint on the same insert the
   * other is mid-way through. Shared while in flight; cleared once it settles (success
   * or error) so a later visit still gets a fresh request, not a stale cached session.
   */
  private startTodaySession$?: Observable<DailyPracticeSession>;

  private get authHeaders() {
    return { headers: { Authorization: `tma ${this.telegram.initData}` } };
  }

  getTodaySession(): Observable<DailyPracticeSession | null> {
    return this.http.get<DailyPracticeSession | null>(
      `${environment.apiBaseUrl}${HttpPracticeService.BASE}/today`,
      this.authHeaders,
    );
  }

  startTodaySession(): Observable<DailyPracticeSession> {
    if (!this.startTodaySession$) {
      this.startTodaySession$ = this.http
        .post<DailyPracticeSession>(`${environment.apiBaseUrl}${HttpPracticeService.BASE}/today/start`, null, this.authHeaders)
        .pipe(
          finalize(() => (this.startTodaySession$ = undefined)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }
    return this.startTodaySession$;
  }

  startNewRound(): Observable<DailyPracticeSession> {
    return this.http.post<DailyPracticeSession>(
      `${environment.apiBaseUrl}${HttpPracticeService.BASE}/today/new-round`,
      null,
      this.authHeaders,
    );
  }

  /** See PracticeService.startRandomPractice's own doc comment — entirely local test data, never sent to the server. `count` comes from the dialog shown when the button is tapped, not from any preference. */
  startRandomPractice(count: number): Observable<DailyPracticeSession> {
    return this.getPreferences().pipe(
      switchMap((prefs) =>
        this.practicePool.pool$.pipe(
          map((pool) => {
            const exercises = pickExercises(this.sgfParser, pool, {
              count,
              shuffled: true,
              topVariants: prefs.topVariants,
              continuationDepth: prefs.continuationDepth,
            });
            const session: DailyPracticeSession = {
              id: newSessionId(),
              kind: 'generated',
              date: new Date().toISOString().slice(0, 10),
              exercises,
              completed: exercises.length === 0,
            };
            this.localPoolSessions.push(session);
            return cloneSession(session);
          }),
        ),
      ),
    );
  }

  listSessions(): Observable<DailyPracticeSession[]> {
    return this.http
      .get<DailyPracticeSession[]>(`${environment.apiBaseUrl}${HttpPracticeService.BASE}/sessions`, this.authHeaders)
      .pipe(map((serverSessions) => [...serverSessions, ...this.localPoolSessions]));
  }

  getSession(sessionId: string): Observable<DailyPracticeSession | null> {
    const localPool = this.localPoolSessions.find((s) => s.id === sessionId);
    if (localPool) return of(cloneSession(localPool));
    return this.http
      .get<DailyPracticeSession>(`${environment.apiBaseUrl}${HttpPracticeService.BASE}/sessions/${sessionId}`, this.authHeaders)
      .pipe(catchError((error) => (error.status === 404 ? of(null) : throwError(() => error))));
  }

  recordResult(sessionId: string, exerciseId: string): Observable<void> {
    const session = this.localPoolSessions.find((s) => s.id === sessionId);
    if (session) {
      const exercise = session.exercises.find((e) => e.id === exerciseId);
      if (exercise) {
        exercise.completed = true;
        session.completed = session.exercises.every((e) => e.completed);
      }
      return of(undefined);
    }
    return this.http.post<void>(
      `${environment.apiBaseUrl}${HttpPracticeService.BASE}/today/exercises/${exerciseId}/result`,
      null,
      this.authHeaders,
    );
  }

  saveProgress(sessionId: string, exerciseId: string, progress: ExerciseProgress): Observable<void> {
    const session = this.localPoolSessions.find((s) => s.id === sessionId);
    if (session) {
      const exercise = session.exercises.find((e) => e.id === exerciseId);
      if (exercise) {
        exercise.selectedVariant = progress.selectedVariant;
        exercise.step = progress.step;
        exercise.currentDepth = progress.currentDepth;
      }
      return of(undefined);
    }
    return this.http.put<void>(
      `${environment.apiBaseUrl}${HttpPracticeService.BASE}/today/exercises/${exerciseId}/progress`,
      progress,
      this.authHeaders,
    );
  }

  getPreferences(): Observable<PracticePreferences> {
    return this.http.get<PracticePreferences>(
      `${environment.apiBaseUrl}${HttpPracticeService.BASE}/preferences`,
      this.authHeaders,
    );
  }

  setPreferences(preferences: PracticePreferences): Observable<void> {
    return this.http.put<void>(
      `${environment.apiBaseUrl}${HttpPracticeService.BASE}/preferences`,
      preferences,
      this.authHeaders,
    );
  }

  getStreak(): Observable<StreakInfo> {
    return this.http.get<StreakInfo>(`${environment.apiBaseUrl}${HttpPracticeService.BASE}/streak`, this.authHeaders);
  }
}
