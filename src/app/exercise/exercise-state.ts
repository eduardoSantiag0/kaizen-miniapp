import GoBoard from '@sabaki/go-board';
import type { Vertex } from '../sgf/sgf-node';
import type { ExerciseTree } from './exercise-tree';

export type Screen = 'loading' | 'ready' | 'error' | 'sgfError';
export type Phase = 'play' | 'reply' | 'wrong' | 'done';
/** Real backend data has no "the historical mistake" branch — see exercise-tree.ts — so there is only one wrong-move reason: the tapped point isn't one of KataGo's offered variants. */
export type WrongReason = 'notEvaluated' | null;
export type IllegalReason = 'suicide' | 'ko' | null;

export interface ExerciseState {
  screen: Screen;
  phase: Phase;
  board: GoBoard;
  /** null until the player's first move picks one of tree.variants; fixed for the rest of the exercise afterward. */
  selectedVariant: number | null;
  /** 1-based index of the user move currently expected. */
  step: number;
  /** Only meaningful once selectedVariant is set — 0 beforehand. */
  totalSteps: number;
  illegal: { vertex: Vertex; reason: IllegalReason } | null;
  lastMove: { vertex: Vertex; sign: 1 | -1 } | null;
  wrongMove: { vertex: Vertex; reason: WrongReason } | null;
  hintOn: boolean;
  zoomedIn: boolean;
  turnSign: 1 | -1;
}

export function vertexEquals(a: Vertex, b: Vertex): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

export function initExerciseState(tree: ExerciseTree): ExerciseState {
  return {
    screen: 'ready',
    phase: 'play',
    board: tree.setupBoard.clone(),
    selectedVariant: null,
    step: 1,
    totalSteps: 0,
    illegal: null,
    lastMove: null,
    wrongMove: null,
    hintOn: false,
    zoomedIn: false,
    turnSign: tree.userSign,
  };
}

export function loadingState(): Pick<ExerciseState, 'screen'> {
  return { screen: 'loading' };
}

/** The minimal, serializable shape a daily-mode exercise resumes from — handoff v4-3-kaizen-daily-practice section 9. */
export interface ExerciseProgress {
  selectedVariant: number | null;
  step: number;
  currentDepth: number;
}

/**
 * Rebuilds the exact state a daily-mode exercise was left in, instead of
 * starting it from scratch — "Continue practice" reopens the first unsolved
 * exercise at the saved position (handoff section 4/9). `maxPlies` is the
 * caller's `1 + progress.currentDepth` (same unit playVertex/goDeeper use).
 * A null/unset selectedVariant resumes exactly like initExerciseState.
 */
export function resumeExerciseState(tree: ExerciseTree, progress: ExerciseProgress, maxPlies: number): ExerciseState {
  const base = initExerciseState(tree);
  if (progress.selectedVariant === null) return base;

  const variant = tree.variants[progress.selectedVariant];
  if (!variant) return base; // out-of-range (e.g. stale data) — fall back to a fresh start rather than throw.

  const totalSteps = Math.ceil(Math.min(maxPlies, variant.plies.length) / 2);
  const step = Math.min(Math.max(progress.step, 1), Math.max(totalSteps, 1));
  const isDone = step >= totalSteps;
  // 'done' means the final user move is already played, with no trailing reply shown
  // (playVertex goes straight to 'done' once isLastStep, never animating one more reply) —
  // an odd ply count. Still mid-line ('play'), the board stops one pair of plies short of
  // the next expected user move — an even count, same as boardAtStepStart's own convention.
  const pliesPlayed = isDone ? (totalSteps - 1) * 2 + 1 : (step - 1) * 2;
  const { board, lastMove } = replayPlies(tree, progress.selectedVariant, pliesPlayed);

  return {
    ...base,
    selectedVariant: progress.selectedVariant,
    totalSteps,
    step,
    phase: isDone ? 'done' : 'play',
    board,
    lastMove,
    turnSign: tree.userSign,
  };
}

function replayPlies(tree: ExerciseTree, variantIndex: number, pliesPlayed: number): { board: GoBoard; lastMove: ExerciseState['lastMove'] } {
  const plies = tree.variants[variantIndex].plies;
  let board = tree.setupBoard.clone();
  let lastMove: ExerciseState['lastMove'] = null;

  for (let i = 0; i < pliesPlayed; i++) {
    const ply = plies[i];
    if (!ply) break;
    board = board.makeMove(ply.sign, ply.vertex, { preventSuicide: true, preventOverwrite: true });
    lastMove = { vertex: ply.vertex, sign: ply.sign };
  }

  return { board, lastMove };
}

function pliesFor(state: ExerciseState, tree: ExerciseTree) {
  // Only called once selectedVariant is guaranteed set (step > 1, or any
  // post-selection path) — see call sites.
  return tree.variants[state.selectedVariant!].plies;
}

/**
 * Tapping an empty point plays it immediately — no preview/confirm step.
 * Illegal (suicide/ko): shows the ring and reason, no move. Legal: plays it
 * right away and resolves correct ('reply'/'done') or incorrect ('wrong').
 *
 * Before a variant is picked (selectedVariant === null), the first move must
 * match one of tree.variants' own first plies to be accepted — there is no
 * single "correct" point, any of KataGo's offered candidates counts.
 *
 * `maxPlies` caps how much of the chosen variant gets shown, following the
 * design handoff's exact formula (docs/design-handoff/v4-kaizen-daily-practice,
 * section 7): `plies = min(maxPlies, plies available in the branch)`, steps
 * (user moves) = `ceil(plies / 2)`. The default of 10 reproduces today's
 * existing menu-mode behaviour exactly — for any branch length ≤ 9 (already
 * enforced by exercise-tree.ts's MAX_PLIES), `ceil(min(10, len) / 2)` and the
 * old `min(5, ceil(len / 2))` formula agree on every input, so ExercisePage's
 * menu mode needs no change to keep working. Daily Practice mode passes
 * `1 + continuationDepth` instead (the chosen first move doesn't count
 * toward the Continuation Depth preference).
 */
export function playVertex(state: ExerciseState, tree: ExerciseTree, vertex: Vertex, maxPlies: number = 10): ExerciseState {
  if (state.phase !== 'play') return state;
  if (state.board.get(vertex)) return state;

  const analysis = state.board.analyzeMove(tree.userSign, vertex);
  if (analysis.pass) return state;

  if (analysis.suicide || analysis.ko) {
    return {
      ...state,
      illegal: { vertex, reason: analysis.suicide ? 'suicide' : 'ko' },
    };
  }

  const board = state.board.makeMove(tree.userSign, vertex, {
    preventSuicide: true,
    preventOverwrite: true,
  });

  if (state.selectedVariant === null) {
    const matchIndex = tree.variants.findIndex((variant) => vertexEquals(variant.plies[0].vertex, vertex));

    if (matchIndex === -1) {
      return {
        ...state,
        board,
        illegal: null,
        phase: 'wrong',
        lastMove: { vertex, sign: tree.userSign },
        wrongMove: { vertex, reason: 'notEvaluated' },
      };
    }

    const variant = tree.variants[matchIndex];
    const totalSteps = Math.ceil(Math.min(maxPlies, variant.plies.length) / 2);
    const isLastStep = totalSteps <= 1;
    const replyExists = !!variant.plies[1];

    return {
      ...state,
      board,
      selectedVariant: matchIndex,
      totalSteps,
      illegal: null,
      wrongMove: null,
      lastMove: { vertex, sign: tree.userSign },
      phase: isLastStep || !replyExists ? 'done' : 'reply',
      turnSign: isLastStep || !replyExists ? state.turnSign : tree.opponentSign,
      // Every correct move turns the hint off — the player asked for it to confirm
      // this one move, not to stay on for the rest of the line.
      hintOn: false,
    };
  }

  const plies = pliesFor(state, tree);
  const expected = plies[(state.step - 1) * 2];
  const isCorrect = !!expected && vertexEquals(expected.vertex, vertex);

  if (!isCorrect) {
    return {
      ...state,
      board,
      illegal: null,
      phase: 'wrong',
      lastMove: { vertex, sign: tree.userSign },
      wrongMove: { vertex, reason: 'notEvaluated' },
    };
  }

  const isLastStep = state.step >= state.totalSteps;
  const replyExists = !!plies[(state.step - 1) * 2 + 1];

  return {
    ...state,
    board,
    illegal: null,
    wrongMove: null,
    lastMove: { vertex, sign: tree.userSign },
    phase: isLastStep || !replyExists ? 'done' : 'reply',
    turnSign: isLastStep || !replyExists ? state.turnSign : tree.opponentSign,
    // Every correct move turns the hint off — see the matching comment above.
    hintOn: false,
  };
}

/** Called once the ~900ms "opponent is answering" delay elapses. */
export function playOpponentReply(state: ExerciseState, tree: ExerciseTree): ExerciseState {
  if (state.phase !== 'reply') return state;

  const plies = pliesFor(state, tree);
  const reply = plies[(state.step - 1) * 2 + 1];
  if (!reply) return { ...state, phase: 'done' };

  const board = state.board.makeMove(reply.sign, reply.vertex, {
    preventSuicide: true,
    preventOverwrite: true,
  });

  return {
    ...state,
    board,
    lastMove: { vertex: reply.vertex, sign: reply.sign },
    phase: 'play',
    step: state.step + 1,
    turnSign: tree.userSign,
  };
}

/**
 * Undo: from 'wrong', removes just the bad move, same step — and, if it was
 * the exercise's first move (no variant picked yet), un-picks the variant
 * too. From 'play' (after at least one correct move), removes the last
 * correct move — and, if that move already got an opponent reply, the reply
 * too — landing back on 'play' at the previous step. There's no instant-tap
 * confirm step to "Cancel" any more, so this is the general recovery action
 * for a misclick. No-op if there's nothing to undo yet (fresh exercise, or
 * mid opponent-reply). Tools never mounts once the line is 'done', so
 * undo() is never reached then.
 */
export function undo(state: ExerciseState, tree: ExerciseTree): ExerciseState {
  if (state.phase === 'wrong') {
    if (state.selectedVariant === null) {
      return {
        ...state,
        phase: 'play',
        board: tree.setupBoard.clone(),
        illegal: null,
        wrongMove: null,
        lastMove: null,
        turnSign: tree.userSign,
      };
    }

    return {
      ...state,
      phase: 'play',
      board: boardAtStepStart(tree, state.selectedVariant, state.step),
      illegal: null,
      wrongMove: null,
      lastMove: lastMoveBeforeStep(tree, state.selectedVariant, state.step),
      turnSign: tree.userSign,
    };
  }

  if (!canUndo(state)) return state;

  if (state.step === 1) {
    // Undo the exercise's very first move — un-pick the variant entirely,
    // back to the same blank slate as initExerciseState.
    return {
      ...state,
      phase: 'play',
      selectedVariant: null,
      totalSteps: 0,
      board: tree.setupBoard.clone(),
      illegal: null,
      wrongMove: null,
      lastMove: null,
      turnSign: tree.userSign,
    };
  }

  const targetStep = state.step - 1;

  return {
    ...state,
    phase: 'play',
    step: targetStep,
    board: boardAtStepStart(tree, state.selectedVariant!, targetStep),
    illegal: null,
    wrongMove: null,
    lastMove: lastMoveBeforeStep(tree, state.selectedVariant!, targetStep),
    turnSign: tree.userSign,
  };
}

/** Whether undo() would do anything right now — drives the Undo tool button's disabled state. */
export function canUndo(state: ExerciseState): boolean {
  switch (state.phase) {
    case 'wrong':
      return true;
    case 'play':
      return state.selectedVariant !== null;
    case 'reply':
    case 'done':
      return false; // 'reply': board is locked mid opponent-reply. 'done': Tools isn't mounted.
  }
}

export function resetExercise(tree: ExerciseTree): ExerciseState {
  return initExerciseState(tree);
}

/**
 * RF03.5 / handoff section 7 "Go Deeper": once an exercise is done, reveals
 * more of the same chosen variant up to `maxPlies` (the caller computes the
 * next value: `min(10, currentContinuationDepth + 2)`, then passes
 * `1 + that` here — same `maxPlies` unit playVertex uses). No-op if that
 * doesn't actually reveal anything new (the variant's real stored data is
 * already exhausted at the current totalSteps), or if no variant was ever
 * selected, or before the exercise is done.
 */
export function goDeeper(state: ExerciseState, tree: ExerciseTree, maxPlies: number): ExerciseState {
  if (state.phase !== 'done' || state.selectedVariant === null) return state;

  const plies = pliesFor(state, tree);
  const totalSteps = Math.ceil(Math.min(maxPlies, plies.length) / 2);
  if (totalSteps <= state.totalSteps) return state;

  const replyExists = !!plies[(state.step - 1) * 2 + 1];

  return {
    ...state,
    totalSteps,
    phase: replyExists ? 'reply' : 'play',
    turnSign: replyExists ? tree.opponentSign : tree.userSign,
  };
}

/** Whether goDeeper(state, tree, maxPlies) would actually reveal anything — drives the "Go deeper" button's disabled state (handoff section 6: shown but disabled at 40% opacity once KataGo's analysis is exhausted, never hidden). */
export function hasMoreToGoDeeper(state: ExerciseState, tree: ExerciseTree, maxPlies: number): boolean {
  if (state.phase !== 'done' || state.selectedVariant === null) return false;
  const plies = pliesFor(state, tree);
  return Math.ceil(Math.min(maxPlies, plies.length) / 2) > state.totalSteps;
}

export function toggleHint(state: ExerciseState): ExerciseState {
  return { ...state, hintOn: !state.hintOn };
}

export function toggleZoom(state: ExerciseState): ExerciseState {
  return { ...state, zoomedIn: !state.zoomedIn };
}

function boardAtStepStart(tree: ExerciseTree, variantIndex: number, step: number): GoBoard {
  const plies = tree.variants[variantIndex].plies;
  let board = tree.setupBoard.clone();
  for (let i = 0; i < (step - 1) * 2; i++) {
    const ply = plies[i];
    if (!ply) break;
    board = board.makeMove(ply.sign, ply.vertex, { preventSuicide: true, preventOverwrite: true });
  }
  return board;
}

function lastMoveBeforeStep(tree: ExerciseTree, variantIndex: number, step: number): ExerciseState['lastMove'] {
  const plies = tree.variants[variantIndex].plies;
  const index = (step - 1) * 2 - 1;
  const ply = plies[index];
  return ply ? { vertex: ply.vertex, sign: ply.sign } : null;
}

/**
 * Before a variant is picked, every candidate's first move is a valid hint
 * target — see hintVertices() for the multi-ring case goban-view.component.ts
 * needs. This single-vertex variant is kept for call sites that only care
 * about "the next expected move" once a variant is already selected (there,
 * it is unambiguous).
 */
export function hintVertex(state: ExerciseState, tree: ExerciseTree): Vertex | null {
  if (!state.hintOn || state.phase === 'done' || state.selectedVariant === null) return null;
  const expected = pliesFor(state, tree)[(state.step - 1) * 2];
  return expected?.vertex ?? null;
}

/** Every point the Hint ring should show right now — one per offered variant before a choice is made, exactly one afterward. Empty once 'done' or hint is off. */
export function hintVertices(state: ExerciseState, tree: ExerciseTree): Vertex[] {
  if (!state.hintOn || state.phase === 'done') return [];

  if (state.selectedVariant === null) {
    return tree.variants.map((variant) => variant.plies[0].vertex);
  }

  const single = hintVertex(state, tree);
  return single ? [single] : [];
}
