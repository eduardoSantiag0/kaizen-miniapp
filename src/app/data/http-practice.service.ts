import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable, of, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { TelegramService } from '../core/telegram.service';
import { PracticePoolService } from './practice-pool.service';
import { PracticeService } from './practice.service';
import type { ExerciseProgress } from '../exercise/exercise-state';
import type { DailyPracticeSession, PracticePreferences, StreakInfo } from './practice.model';
import { SgfParserService } from '../sgf/sgf-parser.service';
import { cloneSession, pickExercises, todayIso } from './practice-exercise-picker';

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
   * frontend test data (see startRandomPractice), so once active it also
   * answers getTodaySession/startTodaySession/recordResult/saveProgress
   * locally instead of asking the backend about a session it's never heard
   * of. Cleared by startNewRound, which is a genuine server round.
   */
  private localSession: DailyPracticeSession | null = null;

  private get authHeaders() {
    return { headers: { Authorization: `tma ${this.telegram.initData}` } };
  }

  getTodaySession(): Observable<DailyPracticeSession | null> {
    if (this.localSession) return of(cloneSession(this.localSession));
    return this.http.get<DailyPracticeSession | null>(
      `${environment.apiBaseUrl}${HttpPracticeService.BASE}/today`,
      this.authHeaders,
    );
  }

  startTodaySession(): Observable<DailyPracticeSession> {
    if (this.localSession) return of(cloneSession(this.localSession));
    return this.http.post<DailyPracticeSession>(
      `${environment.apiBaseUrl}${HttpPracticeService.BASE}/today/start`,
      null,
      this.authHeaders,
    );
  }

  startNewRound(): Observable<DailyPracticeSession> {
    this.localSession = null; // a real new round comes from the server again, not the local test pool
    return this.http.post<DailyPracticeSession>(
      `${environment.apiBaseUrl}${HttpPracticeService.BASE}/today/new-round`,
      null,
      this.authHeaders,
    );
  }

  /**
   * See PracticeService.startRandomPractice's own doc comment — entirely
   * local test data, but still honors the exerciseCount preference (fetched
   * from the real backend, same as any other read), same as a normal session.
   */
  startRandomPractice(): Observable<DailyPracticeSession> {
    return this.getPreferences().pipe(
      switchMap((prefs) =>
        this.practicePool.pool$.pipe(
          map((pool) => {
            const exercises = pickExercises(this.sgfParser, pool, {
              count: prefs.exerciseCount,
              shuffled: true,
              topVariants: prefs.topVariants,
              continuationDepth: prefs.continuationDepth,
            });
            this.localSession = { date: todayIso(), exercises, completed: exercises.length === 0 };
            return cloneSession(this.localSession);
          }),
        ),
      ),
    );
  }

  recordResult(exerciseId: string): Observable<void> {
    if (this.localSession) {
      const exercise = this.localSession.exercises.find((e) => e.id === exerciseId);
      if (exercise) {
        exercise.completed = true;
        this.localSession.completed = this.localSession.exercises.every((e) => e.completed);
      }
      return of(undefined);
    }
    return this.http.post<void>(
      `${environment.apiBaseUrl}${HttpPracticeService.BASE}/today/exercises/${exerciseId}/result`,
      null,
      this.authHeaders,
    );
  }

  saveProgress(exerciseId: string, progress: ExerciseProgress): Observable<void> {
    if (this.localSession) {
      const exercise = this.localSession.exercises.find((e) => e.id === exerciseId);
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
