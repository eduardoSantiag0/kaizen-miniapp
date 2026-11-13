import type { SgfNode } from '../sgf/sgf-node';
import { BLACK, moveOf, WHITE } from '../sgf/sgf-node';
import { SgfParserService } from '../sgf/sgf-parser.service';
import { UnreadableExerciseError, buildExerciseLine } from '../exercise/exercise-line';
import type { GameHistoryDto, GamePhase } from '../data/game-history.model';

/** Chronological order — same as exercise-source.ts's PHASE_ORDER, the order "Next exercise" walks through. */
const CHRONOLOGICAL_PHASES: { phase: GamePhase; key: keyof GameHistoryDto }[] = [
  { phase: 'opening', key: 'openingAnalysed' },
  { phase: 'middlegame', key: 'middlegameAnalysed' },
  { phase: 'endgame', key: 'endgameAnalysed' },
];

export type GameStatus = 'done' | 'running' | 'waiting';

export interface GameListEntry {
  id: string;
  opponentName: string;
  /** The opponent's own rank only (not the combined blackRank/whiteRank pair) — '' if unknown. */
  opponentRank: string;
  boardSize: number;
  /** 'OGS' | 'DGS' | '' — from the SGF's PC[] tag, same convention as exercise-source.ts. */
  server: string;
  /**
   * Best-effort count of moves in whichever phase fragment is available —
   * the DTO only ever carries per-phase SGF fragments, never the full game
   * (GameAnalysisEntity.fullAnalysedGame exists but isn't projected into
   * GameHistoryDto; see docs/backend-contract/game-history-dto.md section 2),
   * so this is not guaranteed to be the true total move count of the game.
   */
  moves: number;
  /** Raw SGF DT[] value (often already "YYYY-MM-DD"); '' if absent. */
  date: string;
  status: GameStatus;
  /** 1-based move number of the branch point in mistakePhases[0] (chronologically first) — only meaningful for 'done'. */
  mistakeMoveNumber: number | null;
  /**
   * Every phase (chronological: opening, middlegame, endgame) that has its own
   * exercise-able mistake — the same phases ExercisePage's "Next exercise"
   * would walk through for this game. Empty when 'running'/'waiting', or when
   * 'done' found nothing to flag (a clean game).
   */
  mistakePhases: GamePhase[];
  userSign: 1 | -1;
  /** Raw RE[] value, e.g. "B+R", "W+4.5" — '' if absent. */
  result: string;
  /** Whether the user's own side won, derived from `result` + `userSign`; null if result is unreadable/absent. */
  won: boolean | null;
}

/**
 * Builds one GamesPage row from a GameHistoryDto. Tries each phase SGF (same
 * priority as exercise-source.ts's loadExercise) and uses the first one that
 * parses, for metadata (board size, players, date, result). *Separately*,
 * in chronological order, it also tries building a full exercise from every
 * phase (not just the first parseable one) for 'done' status + mistakePhases
 * — the same phases ExercisePage's "Next exercise" walks through for this
 * game — so the row can say "N mistakes to study" instead of only ever
 * reporting the first one it finds.
 *
 * Status is a frontend-only derivation from the nullable per-phase SGF
 * fields already in the real contract, not a backend field:
 * 'done' = analysis is complete — either a branch point was found in at
 * least one phase (mistakePhases is non-empty) or none was (a clean game,
 * nothing to flag).
 * 'running' = at least one phase SGF exists, but none has a branch point yet.
 *
 * All three phases null is 'done' (clean), NOT 'waiting': the backend only
 * ever creates a GameAnalysisEntity row from one unconditional save() at the
 * END of a completed analysis callback (confirmed against
 * AnalysisAggregator.java/KatagoAssembler.java) — a not-yet-started or
 * in-progress job produces no row at all, so GET /history can never actually
 * return a row that's still pending. An all-null row can only mean KataGo
 * found nothing worth flagging in any phase. 'waiting' is kept as a type for
 * a genuinely-corrupt edge case below (phases present but none parse at all,
 * as opposed to genuinely absent) — whether 'running'/'waiting' make sense
 * at all given this is still being decided separately; this fix only
 * addresses the clear, unambiguous all-null misclassification.
 */
export function deriveGameListEntry(dto: GameHistoryDto, sgfParser: SgfParserService): GameListEntry {
  const phaseTexts = [dto.middlegameAnalysed, dto.openingAnalysed, dto.endgameAnalysed];
  const allPhasesAbsent = phaseTexts.every((sgf) => sgf === null);

  const parsedPhases: SgfNode[] = [];
  for (const sgf of phaseTexts) {
    if (sgf === null) continue;
    try {
      parsedPhases.push(sgfParser.parse(sgf).root);
    } catch {
      // Unreadable phase SGF — skip, same as loadExercise.
    }
  }

  const root: SgfNode | null = parsedPhases[0] ?? null;

  let status: GameStatus = allPhasesAbsent ? 'done' : parsedPhases.length ? 'running' : 'waiting';
  let mistakeMoveNumber: number | null = null;
  const mistakePhases: GamePhase[] = [];

  // Separate, chronologically-ordered pass (independent of the metadata pass
  // above, which only keeps the first parseable phase) — collects every
  // phase with its own mistake instead of stopping at the first one, so the
  // row can show "N mistakes to study" instead of hiding the rest.
  for (const { phase, key } of CHRONOLOGICAL_PHASES) {
    const sgf = dto[key];
    if (sgf === null) continue;

    let phaseRoot: SgfNode;
    try {
      phaseRoot = sgfParser.parse(sgf).root;
    } catch {
      continue; // Unreadable phase SGF — skip, same as the metadata pass above.
    }

    try {
      buildExerciseLine(phaseRoot);
      status = 'done';
      mistakePhases.push(phase);
      if (mistakeMoveNumber === null) mistakeMoveNumber = branchPointDepth(phaseRoot);
    } catch (error) {
      if (!(error instanceof UnreadableExerciseError)) throw error;
    }
  }

  const userSign = root ? (root.data['PL']?.[0] === 'W' ? WHITE : BLACK) : BLACK;
  const blackName = root?.data['PB']?.[0] ?? dto.blackPlayer ?? '';
  const whiteName = root?.data['PW']?.[0] ?? dto.whitePlayer ?? '';
  const blackRank = root?.data['BR']?.[0] ?? null;
  const whiteRank = root?.data['WR']?.[0] ?? null;

  const opponentName = userSign === BLACK ? whiteName : blackName;
  const opponentRank = (userSign === BLACK ? whiteRank : blackRank) ?? '';

  const pc = root?.data['PC']?.[0] ?? '';
  const server = /ogs|online-go/i.test(pc) ? 'OGS' : /dgs|dragongoserver/i.test(pc) ? 'DGS' : '';

  const result = root?.data['RE']?.[0] ?? '';
  const won = result ? result.toUpperCase().startsWith(userSign === BLACK ? 'B' : 'W') : null;

  return {
    id: dto.id,
    opponentName,
    opponentRank,
    boardSize: Number(root?.data['SZ']?.[0] ?? 19),
    server,
    moves: root ? countMoves(root) : 0,
    date: root?.data['DT']?.[0] ?? '',
    status,
    mistakeMoveNumber,
    mistakePhases,
    userSign,
    result,
    won,
  };
}

/** Counts B/W nodes along the tree's first-child chain from the root. */
function countMoves(root: SgfNode): number {
  let count = 0;
  let node: SgfNode | undefined = root;
  while (node) {
    if (moveOf(node)) count++;
    node = node.children[0];
  }
  return count;
}

/** 1-based move number of the first node with more than one child (buildExerciseLine's branch point). */
function branchPointDepth(root: SgfNode): number {
  let count = 0;
  let node: SgfNode | undefined = root;
  while (node && node.children.length === 1) {
    if (moveOf(node)) count++;
    node = node.children[0];
  }
  return count + 1;
}
