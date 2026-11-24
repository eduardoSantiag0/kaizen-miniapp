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
  abstract recordResult(exerciseId: string): Observable<void>;
  /** Save after every confirmed move, Try another line and Go deeper (handoff v4-3 section 9). */
  abstract saveProgress(exerciseId: string, progress: ExerciseProgress): Observable<void>;
  abstract getPreferences(): Observable<PracticePreferences>;
  abstract setPreferences(preferences: PracticePreferences): Observable<void>;
  abstract getStreak(): Observable<StreakInfo>;
}
