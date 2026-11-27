import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, finalize, Observable, of, shareReplay, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { TelegramService } from '../core/telegram.service';
import { PracticeService } from './practice.service';
import type { DailyPracticeSession, PracticeSessionKind, PracticeSessionPage, PracticePreferences, StreakInfo } from './practice.model';

/**
 * Real HTTP-backed PracticeService, per
 * docs/backend-contract/daily-practice-endpoint-proposal.md — kaizan-companion's
 * PracticeController/PracticeService now implement this for real (including
 * POST /practice/random, which backs "Random practice" straight off the
 * shared public pool — see that endpoint's own doc comment). Every exercise
 * a response carries (personal or dataset) is already a complete,
 * ready-to-render PracticeExerciseRef — this service is a thin HTTP
 * passthrough, no session-building logic of its own.
 */
@Injectable()
export class HttpPracticeService extends PracticeService {
  private readonly http = inject(HttpClient);
  private readonly telegram = inject(TelegramService);

  override get storageAccountId(): string | null {
    try {
      const user = JSON.parse(new URLSearchParams(this.telegram.initData).get('user') ?? 'null');
      return Number.isSafeInteger(user?.id) && user.id > 0 ? String(user.id) : null;
    } catch {
      return null;
    }
  }

  private static readonly BASE = '/kaizan/api/v1/practice';

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
    return this.http.get<DailyPracticeSession | null>(`${environment.apiBaseUrl}${HttpPracticeService.BASE}/today`, this.authHeaders);
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

  /** See PracticeService.startRandomPractice's own doc comment. `count` comes from the dialog shown when the button is tapped, not from any preference. */
  startRandomPractice(count: number): Observable<DailyPracticeSession> {
    return this.http.post<DailyPracticeSession>(
      `${environment.apiBaseUrl}${HttpPracticeService.BASE}/random?count=${count}`,
      null,
      this.authHeaders,
    );
  }

  listSessions(page = 0, size = 20, kind?: PracticeSessionKind): Observable<PracticeSessionPage> {
    return this.http.get<PracticeSessionPage>(`${environment.apiBaseUrl}${HttpPracticeService.BASE}/sessions`, {
      ...this.authHeaders,
      params: kind ? { page, size, kind } : { page, size },
    });
  }

  getSession(sessionId: string): Observable<DailyPracticeSession | null> {
    return this.http
      .get<DailyPracticeSession>(`${environment.apiBaseUrl}${HttpPracticeService.BASE}/sessions/${sessionId}`, this.authHeaders)
      .pipe(catchError((error) => (error.status === 404 ? of(null) : throwError(() => error))));
  }

  recordResult(sessionId: string, exerciseId: string): Observable<void> {
    return this.http.post<void>(
      `${environment.apiBaseUrl}${HttpPracticeService.BASE}/sessions/${sessionId}/exercises/${exerciseId}/result`,
      null,
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
