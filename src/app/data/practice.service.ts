import { Observable } from 'rxjs';
import type { ExerciseProgress } from '../exercise/exercise-state';
import type { DailyPracticeSession, PracticePreferences, StreakInfo } from './practice.model';

/**
 * Abstraction over the (not yet implemented) Daily Practice backend — see
 * docs/backend-contract/daily-practice-endpoint-proposal.md. Same pattern as
 * GameHistoryService: swap the provider in app.config.ts once a real
 * backend exists, nothing that injects PracticeService needs to change.
 */
export abstract class PracticeService {
  /** null when the chat hasn't started a session today yet. */
  abstract getTodaySession(): Observable<DailyPracticeSession | null>;
  /** Idempotent — returns the existing session unchanged if one already exists for today. */
  abstract startTodaySession(): Observable<DailyPracticeSession>;
  /**
   * "Continue practicing" once today's original session is already complete
   * (Daily Practice Home) — unlike startTodaySession, this always replaces
   * today's `kind: 'daily'` session with a fresh batch instead of returning
   * the existing one. Speculative, like every other member here: no
   * corresponding backend endpoint exists yet (see HttpPracticeService and
   * docs/backend-contract/daily-practice-endpoint-proposal.md).
   */
  abstract startNewRound(): Observable<DailyPracticeSession>;
  /**
   * "Random practice" (Daily Practice Home, below Start practice) — builds a
   * brand new `kind: 'generated'` session entirely from the bundled
   * practice-pool (public/practice-pool/practice-pool.json), ignoring the
   * chat's own games and the exerciseSource preference entirely. Unlike
   * startTodaySession/startNewRound, this never replaces anything — every
   * call adds one more session to the list, alongside the one always-present
   * daily session, and none of them ever affect the streak. `count` (1-10)
   * comes from the dialog shown when the button is tapped, independent of
   * the exerciseCount preference (which only sizes the daily session).
   */
  abstract startRandomPractice(count: number): Observable<DailyPracticeSession>;
  /** Every session for the chat — the one daily session (if started today) plus any generated ones, newest first. Drives Daily Practice Home's session list. */
  abstract listSessions(): Observable<DailyPracticeSession[]>;
  /** A specific session by id, for opening one picked from listSessions() — null if it doesn't belong to this chat. */
  abstract getSession(sessionId: string): Observable<DailyPracticeSession | null>;
  abstract recordResult(sessionId: string, exerciseId: string): Observable<void>;
  /** Save after every confirmed move, Try another line and Go deeper (handoff v4-3 section 9). */
  abstract saveProgress(sessionId: string, exerciseId: string, progress: ExerciseProgress): Observable<void>;
  abstract getPreferences(): Observable<PracticePreferences>;
  abstract setPreferences(preferences: PracticePreferences): Observable<void>;
  abstract getStreak(): Observable<StreakInfo>;
}
