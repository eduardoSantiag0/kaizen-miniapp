import type { GamePhase } from './game-history.model';

/**
 * Where one exercise's game actually came from — the chat's own analysed
 * games ('personal') or the shared public pool every chat can draw from
 * ('dataset' — kaizan-companion's ExerciseOrigin.PUBLIC, seeded from
 * dataset/games.json, no owning chat). Purely an identification tag the
 * real backend now sets on every ExerciseDto: the exercise engine itself
 * (exercise-tree.ts/ExercisePageComponent) never reads it and never branches
 * on it — both origins already resolve to the exact same ExerciseTree
 * through the exact same code path, only the display layer (daily-practice-
 * home.component.html's "Community exercise" row) cares.
 */
export type ExerciseOrigin = 'personal' | 'dataset';

export interface PracticeExerciseRef {
  id: string;
  gameId: string;
  phase: GamePhase;
  completed: boolean;
  origin: ExerciseOrigin;
  /** SGF for this exercise, including exercises from the public pool. */
  sgf: string;
  opponentName: string;
  opponentRank: string;
  boardSize: number;
  userSign: 1 | -1;
  /** 1-based move number of this exercise's branch point. */
  moveNumber: number;
  topVariants: number;
  requiredDepth: number;
}

/** handoff v4-3-kaizen-daily-practice section 8 — oldest-first, 7 entries, the last one being today. */
export interface StreakInfo {
  currentStreak: number;
  last7Days: boolean[];
  date?: string;
  timeZone?: string;
}

/**
 * 'daily': the one auto-generated session for a calendar day — at most one
 * per date, drives the streak. 'generated': an ad-hoc extra round ("Random
 * practice"/future "generate more"), any number of them, never replacing
 * the daily one and never affecting the streak.
 */
export type PracticeSessionKind = 'daily' | 'generated';

export interface PracticeSessionSummary {
  id: string;
  kind: PracticeSessionKind;
  date: string;
  completed: boolean;
  exerciseCount: number;
  completedCount: number;
}

export interface PracticeSessionPage {
  sessions: PracticeSessionSummary[];
  nextPage: number | null;
}

export interface DailyPracticeSession {
  id: string;
  kind: PracticeSessionKind;
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
/**
 * 'own' (default): only exercises built from the chat's own analyzed games.
 * 'mixed': pads a session with the shared public pool once the chat's own
 * games run out, instead of a shorter session — resolved server-side now
 * (kaizan-companion's PracticeService.populateExercises); MockPracticeService
 * has no local pool of its own to pad with, so 'mixed' behaves like 'own' there.
 */
export type ExerciseSource = 'own' | 'mixed';

export interface PracticePreferences {
  /** 1-5, default 3. */
  topVariants: number;
  /** 2-10, default 4. */
  continuationDepth: number;
  exerciseSource: ExerciseSource;
  /** How many exercises make up one daily session. 1-10, default 5. */
  exerciseCount: number;
}

export const DEFAULT_PRACTICE_PREFERENCES: PracticePreferences = {
  topVariants: 3,
  continuationDepth: 4,
  exerciseSource: 'own',
  exerciseCount: 5,
};
