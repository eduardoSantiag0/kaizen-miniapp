import type GameTree from '@sabaki/immutable-gametree';
import type { GameHistoryDto, GamePhase } from '../data/game-history.model';
import { SgfParserService } from '../sgf/sgf-parser.service';
import { buildExerciseLine, UnreadableExerciseError, type ExerciseLine } from './exercise-line';

export interface LoadedExercise {
  phase: GamePhase;
  line: ExerciseLine;
  /** Read straight from the SGF's own PB/PW/BR/WR — not a DTO field. */
  opponentLabel: string;
  /** Read from the SGF's PC field when it names OGS or DGS; '' otherwise. */
  server: string;
}

/** Order in which phases are tried to find the one with a branch point to exercise. games_test/ convention — see module doc below. */
const PHASE_PRIORITY: GamePhase[] = ['middlegame', 'opening', 'endgame'];

/**
 * games_test/ mock convention: GameHistoryDto carries all three phase SGFs,
 * but only one of them (in our placeholder data, any of them) has the
 * branch-point structure an exercise needs. There is no backend field yet
 * saying which phase holds "the biggest mistake", so this tries each phase's
 * SGF in a fixed priority order and uses the first one that parses into an
 * exercise. This heuristic — not a contract field — goes away once the real
 * endpoint tells us the phase directly.
 */
export function loadExercise(dto: GameHistoryDto, sgfParser: SgfParserService): LoadedExercise {
  const attempts: Array<{ phase: GamePhase; sgf: string | null }> = PHASE_PRIORITY.map((phase) => ({
    phase,
    sgf: dto[phaseKey(phase)],
  }));

  let lastError: unknown;

  for (const { phase, sgf } of attempts) {
    if (!sgf) continue;

    try {
      const tree = sgfParser.parse(sgf);
      const line = buildExerciseLine(tree.root);
      return { phase, line, ...gameInfo(tree, line.userSign) };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new UnreadableExerciseError('No phase SGF produced an exercise');
}

function phaseKey(phase: GamePhase): keyof GameHistoryDto {
  return phase === 'opening'
    ? 'openingAnalysed'
    : phase === 'middlegame'
      ? 'middlegameAnalysed'
      : 'endgameAnalysed';
}

function gameInfo(tree: GameTree, userSign: 1 | -1): { opponentLabel: string; server: string } {
  const data = tree.root.data;
  const black = label(data['PB']?.[0], data['BR']?.[0]);
  const white = label(data['PW']?.[0], data['WR']?.[0]);
  const opponentLabel = userSign === 1 ? white : black;

  const pc = data['PC']?.[0] ?? '';
  const server = /ogs|online-go/i.test(pc) ? 'OGS' : /dgs|dragongoserver/i.test(pc) ? 'DGS' : '';

  return { opponentLabel, server };
}

function label(name?: string, rank?: string): string {
  if (!name) return '';
  return rank ? `${name} ${rank}` : name;
}
