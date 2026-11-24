import type { GamePhase } from './game-history.model';

/**
 * One exercise within a Daily Practice session (RF03.1/RF03.6). Not yet a
 * real backend field set — see docs/backend-contract/daily-practice-endpoint-proposal.md.
 */
export interface PracticeExerciseRef {
  id: string;
  gameId: string;
  phase: GamePhase;
  completed: boolean;
  /**
   * Display fields for DailyPracticeHome's exercise rows (handoff
   * v4-kaizen-daily-practice section 4 — "vs kitsune77 4k" / "Black to play
   * · 19×19 · move 75"). Derived from the game's own SGF the same way
   * GamesPage's GameListEntry is, not a real backend field yet — see
   * docs/backend-contract/daily-practice-endpoint-proposal.md.
   */
  opponentName: string;
  opponentRank: string;
  boardSize: number;
  userSign: 1 | -1;
  /** 1-based move number of this exercise's branch point. */
  moveNumber: number;
  /**
   * Resumable progress (handoff v4-3-kaizen-daily-practice section 9) —
   * snapshotted once per exercise so a later preference change never
   * retroactively invalidates it (handoff section 12, open question 4).
   */
  topVariants: number;
  currentDepth: number;
  selectedVariant: number | null;
  step: number;
}

/** handoff v4-3-kaizen-daily-practice section 8 — oldest-first, 7 entries, the last one being today. */
export interface StreakInfo {
  currentStreak: number;
  last7Days: boolean[];
}

export interface DailyPracticeSession {
  /** ISO date (YYYY-MM-DD) this session belongs to. */
  date: string;
  exercises: PracticeExerciseRef[];
  completed: boolean;
}

/**
 * RF02.2/RF03.4 — same preference pair, reused by Daily Practice. Defaults
 * confirmed by the design handoff (docs/design-handoff/v4-kaizen-daily-practice,
 * sections 5 and 7), which resolves the RF02.2-vs-RF03.4 discrepancy in
 * favor of 4 — see the proposal doc's "Resolved" note.
 */
export interface PracticePreferences {
  /** 1-5, default 3. */
  topVariants: number;
  /** 2-10, default 4. */
  continuationDepth: number;
}

export const DEFAULT_PRACTICE_PREFERENCES: PracticePreferences = {
  topVariants: 3,
  continuationDepth: 4,
};
