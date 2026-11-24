import GoBoard from '@sabaki/go-board';
import type { SgfNode, Vertex } from '../sgf/sgf-node';
import { BLACK, WHITE, moveOf, parseVertexList } from '../sgf/sgf-node';

export interface ExercisePly {
  sign: 1 | -1;
  vertex: Vertex;
}

export interface ExerciseVariant {
  /** One candidate branch's full move sequence, alternating starting with the user's sign, capped at 9 plies (5 user moves + 4 replies). */
  plies: ExercisePly[];
}

export interface ExerciseTree {
  boardSize: number;
  setupBoard: GoBoard;
  userSign: 1 | -1;
  opponentSign: 1 | -1;
  /** The real game's own last move before this juncture (the move leading into setupBoard's position) — display-only, marked with the same dot as an in-exercise last move. Null when the branch point sits directly at the SGF root, with no move chain before it (every games_test/ fixture today). */
  previousMove: ExercisePly | null;
  /**
   * Every sibling at the branch point, ranked best-first — KatagoAssembler
   * (kaizan-companion) already sorts KataGo's own top candidates by rank
   * before persisting them as SGF variation branches. Real backend data has
   * no "wrong answer"/"mistake" branch at all: every variant here is one of
   * KataGo's own recommendations.
   */
  variants: ExerciseVariant[];
}

export class UnreadableExerciseError extends Error {
  constructor(message = 'SGF has no branch point to build an exercise from') {
    super(message);
  }
}

// 1 initial move + the max Continuation Depth (M=10, handoff section 5/7) —
// Daily Practice's "Go deeper" needs real data up to this depth to ever
// reach its own stated ceiling. See daily-practice-endpoint-proposal.md
// section 1.5 for the matching backend-side requirement (KatagoAssembler's
// VARIATION_MOVES_LIMIT must store at least this many plies per variant).
const MAX_PLIES = 11;

export function buildExerciseTree(root: SgfNode): ExerciseTree {
  const boardSize = Number(root.data['SZ']?.[0] ?? 19);
  const { branchNode, precedingMoves } = walkToBranchPoint(root);
  if (!branchNode || branchNode.children.length < 2) {
    throw new UnreadableExerciseError();
  }

  let setupBoard = GoBoard.fromDimensions(boardSize);
  for (const vertex of parseVertexList(root.data['AB'])) setupBoard.set(vertex, BLACK);
  for (const vertex of parseVertexList(root.data['AW'])) setupBoard.set(vertex, WHITE);
  for (const ply of precedingMoves) {
    setupBoard = setupBoard.makeMove(ply.sign, ply.vertex, { preventSuicide: true, preventOverwrite: true });
  }

  const previousMove = precedingMoves.length ? precedingMoves[precedingMoves.length - 1] : null;

  const userSign: 1 | -1 = root.data['PL']?.[0] === 'W' ? WHITE : BLACK;
  const opponentSign: 1 | -1 = userSign === BLACK ? WHITE : BLACK;

  const variants: ExerciseVariant[] = branchNode.children
    .map((child) => ({ plies: walkMainLine(child) }))
    .filter((variant) => variant.plies.length > 0);

  return {
    boardSize,
    setupBoard,
    userSign,
    opponentSign,
    previousMove,
    variants,
  };
}

/**
 * Walks from root down through single-child nodes to the branch point,
 * collecting the real game's own moves along the way (root itself carries no
 * move — just AB/AW/PL — so every node actually walked through does). Those
 * are moves already played in the real game before this juncture, in order;
 * the last of them (if any) is the "previous move" shown on the board.
 */
function walkToBranchPoint(root: SgfNode): { branchNode: SgfNode | null; precedingMoves: ExercisePly[] } {
  const precedingMoves: ExercisePly[] = [];
  let current = root;

  while (current.children.length === 1) {
    current = current.children[0];
    const move = moveOf(current);
    if (move) precedingMoves.push(move);
  }

  return { branchNode: current.children.length > 1 ? current : null, precedingMoves };
}

function walkMainLine(start: SgfNode): ExercisePly[] {
  const plies: ExercisePly[] = [];
  let node: SgfNode | undefined = start;

  while (node && plies.length < MAX_PLIES) {
    const move = moveOf(node);
    if (!move) break;
    plies.push(move);
    node = node.children[0];
  }

  return plies;
}
