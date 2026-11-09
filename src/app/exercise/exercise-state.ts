import GoBoard from '@sabaki/go-board';
import type { Vertex } from '../sgf/sgf-node';
import type { ExerciseLine } from './exercise-line';

export type Screen = 'loading' | 'ready' | 'error' | 'sgfError';
export type Phase = 'play' | 'reply' | 'wrong' | 'done';
export type WrongReason = 'mistakeMove' | 'otherMove' | null;
export type IllegalReason = 'suicide' | 'ko' | null;

export interface ExerciseState {
  screen: Screen;
  phase: Phase;
  board: GoBoard;
  /** 1-based index of the user move currently expected. */
  step: number;
  totalSteps: number;
  preview: Vertex | null;
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

export function initExerciseState(line: ExerciseLine): ExerciseState {
  return {
    screen: 'ready',
    phase: 'play',
    board: line.setupBoard.clone(),
    step: 1,
    totalSteps: line.totalSteps,
    preview: null,
    illegal: null,
    lastMove: null,
    wrongMove: null,
    hintOn: false,
    zoomedIn: true,
    turnSign: line.userSign,
  };
}

export function loadingState(): Pick<ExerciseState, 'screen'> {
  return { screen: 'loading' };
}

/** Tapping an empty point: illegal -> show the ring and reason; legal and new -> preview; legal and same as current preview -> caller should confirm instead. */
export function tapVertex(state: ExerciseState, line: ExerciseLine, vertex: Vertex): ExerciseState {
  if (state.phase !== 'play') return state;
  if (state.board.get(vertex)) return state;

  const analysis = state.board.analyzeMove(line.userSign, vertex);
  if (analysis.pass) return state;

  if (analysis.suicide || analysis.ko) {
    return {
      ...state,
      preview: null,
      illegal: { vertex, reason: analysis.suicide ? 'suicide' : 'ko' },
    };
  }

  return { ...state, preview: vertex, illegal: null };
}

export function cancelPreview(state: ExerciseState): ExerciseState {
  return { ...state, preview: null };
}

/** Confirms the previewed move: plays it, and branches into 'wrong' or the next reply/done phase. */
export function confirmMove(state: ExerciseState, line: ExerciseLine): ExerciseState {
  if (state.phase !== 'play' || !state.preview) return state;

  const vertex = state.preview;
  const expected = line.kataGoLine[(state.step - 1) * 2];
  const isCorrect = !!expected && vertexEquals(expected.vertex, vertex);

  const board = state.board.makeMove(line.userSign, vertex, {
    preventSuicide: true,
    preventOverwrite: true,
  });

  if (!isCorrect) {
    const reason: WrongReason =
      line.mistakeVertex && vertexEquals(line.mistakeVertex, vertex) ? 'mistakeMove' : 'otherMove';

    return {
      ...state,
      board,
      preview: null,
      illegal: null,
      phase: 'wrong',
      lastMove: { vertex, sign: line.userSign },
      wrongMove: { vertex, reason },
    };
  }

  const isLastStep = state.step >= state.totalSteps;
  const replyExists = !!line.kataGoLine[(state.step - 1) * 2 + 1];

  return {
    ...state,
    board,
    preview: null,
    illegal: null,
    wrongMove: null,
    lastMove: { vertex, sign: line.userSign },
    phase: isLastStep || !replyExists ? 'done' : 'reply',
    turnSign: isLastStep || !replyExists ? state.turnSign : line.opponentSign,
    hintOn: isLastStep ? false : state.hintOn,
  };
}

/** Called once the ~900ms "opponent is answering" delay elapses. */
export function playOpponentReply(state: ExerciseState, line: ExerciseLine): ExerciseState {
  if (state.phase !== 'reply') return state;

  const reply = line.kataGoLine[(state.step - 1) * 2 + 1];
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
    turnSign: line.userSign,
  };
}

/** "Try again": returns to the position before the wrong move, same step. */
export function tryAgain(state: ExerciseState, line: ExerciseLine): ExerciseState {
  if (state.phase !== 'wrong') return state;

  return {
    ...state,
    phase: 'play',
    board: boardAtStepStart(line, state.step),
    preview: null,
    illegal: null,
    wrongMove: null,
    lastMove: lastMoveBeforeStep(line, state.step),
    turnSign: line.userSign,
  };
}

export function resetExercise(line: ExerciseLine): ExerciseState {
  return initExerciseState(line);
}

export function toggleHint(state: ExerciseState): ExerciseState {
  return { ...state, hintOn: !state.hintOn };
}

export function toggleZoom(state: ExerciseState): ExerciseState {
  return { ...state, zoomedIn: !state.zoomedIn };
}

function boardAtStepStart(line: ExerciseLine, step: number): GoBoard {
  let board = line.setupBoard.clone();
  for (let i = 0; i < (step - 1) * 2; i++) {
    const ply = line.kataGoLine[i];
    if (!ply) break;
    board = board.makeMove(ply.sign, ply.vertex, { preventSuicide: true, preventOverwrite: true });
  }
  return board;
}

function lastMoveBeforeStep(line: ExerciseLine, step: number): ExerciseState['lastMove'] {
  const index = (step - 1) * 2 - 1;
  const ply = line.kataGoLine[index];
  return ply ? { vertex: ply.vertex, sign: ply.sign } : null;
}

/** The next correct point, for the Hint ring; null once the line is complete. */
export function hintVertex(state: ExerciseState, line: ExerciseLine): Vertex | null {
  if (!state.hintOn || state.phase === 'done') return null;
  const expected = line.kataGoLine[(state.step - 1) * 2];
  return expected?.vertex ?? null;
}
