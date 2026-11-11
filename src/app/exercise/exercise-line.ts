import GoBoard from '@sabaki/go-board';
import type { SgfNode, Vertex } from '../sgf/sgf-node';
import { BLACK, WHITE, moveOf, parseVertexList } from '../sgf/sgf-node';

export interface ExercisePly {
  sign: 1 | -1;
  vertex: Vertex;
}

export interface ExerciseLine {
  boardSize: number;
  setupBoard: GoBoard;
  userSign: 1 | -1;
  opponentSign: 1 | -1;
  /** The move actually played in the game at this juncture — display-only, and the one wrong answer with its own copy. */
  mistakeVertex: Vertex | null;
  /** The real game's own last move before this juncture (the move leading into setupBoard's position) — display-only, marked with the same dot as an in-exercise last move. Null when the branch point sits directly at the SGF root, with no move chain before it (every games_test/ fixture today). */
  previousMove: ExercisePly | null;
  /** KataGo's recommended continuation, alternating starting with the user's sign, capped at 9 plies (5 user moves + 4 replies). */
  kataGoLine: ExercisePly[];
  /** First moves of the remaining sibling branches: other plausible-but-wrong answers, step 1 only. */
  distractorVertices: Vertex[];
  totalSteps: number;
}

export class UnreadableExerciseError extends Error {
  constructor(message = 'SGF has no branch point to build an exercise from') {
    super(message);
  }
}

const MAX_PLIES = 9;

/**
 * Mock-data convention (games_test/ only — there is no backend field for this yet):
 * the branch point is the first node with more than one child, walking down from
 * the tree root. Its siblings are ordered:
 *   [0]      KataGo's recommended line — correct for every step.
 *   [1]      the move actually played in the game — the mistake itself. Wrong,
 *            and only this one gets the "that's the move you played" copy.
 *   [2..]    other legal sibling moves — generic "not KataGo's move" wrong answers.
 * This ordering is specific to the placeholder SGFs under games_test/ and must
 * not be treated as something the real GameHistoryDto will provide.
 */
export function buildExerciseLine(root: SgfNode): ExerciseLine {
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

  const [kataGoChild, mistakeChild, ...distractorChildren] = branchNode.children;

  const kataGoLine = walkMainLine(kataGoChild);
  const mistakeMove = mistakeChild ? moveOf(mistakeChild) : null;
  const distractorVertices = distractorChildren
    .map((child) => moveOf(child))
    .filter((move): move is NonNullable<typeof move> => move !== null)
    .map((move) => move.vertex);

  return {
    boardSize,
    setupBoard,
    userSign,
    opponentSign,
    mistakeVertex: mistakeMove?.vertex ?? null,
    previousMove,
    kataGoLine,
    distractorVertices,
    totalSteps: Math.min(5, Math.ceil(kataGoLine.length / 2)),
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
