import { Observable } from 'rxjs';
import type { DailyPracticeSession, PracticeSessionKind, PracticeSessionPage, PracticePreferences, StreakInfo } from './practice.model';

/**
 * Abstraction over the Daily Practice backend — kaizan-companion's
 * PracticeController/PracticeService implement docs/backend-contract/
 * daily-practice-endpoint-proposal.md for real now (HttpPracticeService).
 * Same pattern as GameHistoryService: swap the provider in app.config.ts
 * (environment.useRealBackend), nothing that injects PracticeService needs
 * to change. MockPracticeService remains the local-dev-only stand-in
 * (CLAUDE.md's MVP scope: local frontend work shouldn't depend on a running
 * backend).
 */
export abstract class PracticeService {
  get storageAccountId(): string | null {
    return 'standalone';
  }

  /** null when the chat hasn't started a session today yet. */
  abstract getTodaySession(): Observable<DailyPracticeSession | null>;
  /** Idempotent — returns the existing session unchanged if one already exists for today. */
  abstract startTodaySession(): Observable<DailyPracticeSession>;
  /**
   * "Continue practicing" once today's original session is already complete
   * (Daily Practice Home) — unlike startTodaySession, this always adds a
   * fresh `kind: 'generated'` batch rather than returning/replacing the
   * existing one (the one `kind: 'daily'` session stays untouched, so it
   * never un-earns the streak already counted for today).
   */
  abstract startNewRound(): Observable<DailyPracticeSession>;
  /**
   * "Random practice" (Daily Practice Home, below Start practice) — builds a
   * brand new `kind: 'generated'` session entirely from the shared public
   * pool (kaizan-companion's ExerciseOrigin.PUBLIC, seeded from
   * dataset/games.json — see POST /practice/random), ignoring the chat's own
   * games and the exerciseSource preference entirely. Unlike
   * startTodaySession/startNewRound, this never replaces anything — every
   * call adds one more session to the list, alongside the one always-present
   * daily session, and none of them ever affect the streak. `count` (1-10)
   * comes from the dialog shown when the button is tapped, independent of
   * the exerciseCount preference (which only sizes the daily session).
   */
  abstract startRandomPractice(count: number): Observable<DailyPracticeSession>;
  /** Every session for the chat — the one daily session (if started today) plus any generated ones, newest first. Drives Daily Practice Home's session list. */
  abstract listSessions(page?: number, size?: number, kind?: PracticeSessionKind): Observable<PracticeSessionPage>;
  /** A specific session by id, for opening one picked from listSessions() — null if it doesn't belong to this chat. */
  abstract getSession(sessionId: string): Observable<DailyPracticeSession | null>;
  abstract recordResult(sessionId: string, exerciseId: string): Observable<void>;
  abstract getPreferences(): Observable<PracticePreferences>;
  abstract setPreferences(preferences: PracticePreferences): Observable<void>;
  abstract getStreak(): Observable<StreakInfo>;
}
