import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { TelegramService } from '../core/telegram.service';
import { PracticeService } from './practice.service';
import type { ExerciseProgress } from '../exercise/exercise-state';
import type { DailyPracticeSession, PracticePreferences, StreakInfo } from './practice.model';

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

  private static readonly BASE = '/kaizan/api/v1/practice';

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
    return this.http.post<DailyPracticeSession>(
      `${environment.apiBaseUrl}${HttpPracticeService.BASE}/today/start`,
      null,
      this.authHeaders,
    );
  }

  recordResult(exerciseId: string): Observable<void> {
    return this.http.post<void>(
      `${environment.apiBaseUrl}${HttpPracticeService.BASE}/today/exercises/${exerciseId}/result`,
      null,
      this.authHeaders,
    );
  }

  saveProgress(exerciseId: string, progress: ExerciseProgress): Observable<void> {
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
