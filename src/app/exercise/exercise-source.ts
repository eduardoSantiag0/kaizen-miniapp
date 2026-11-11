import type GameTree from '@sabaki/immutable-gametree';
import type { GameHistoryDto, GamePhase } from '../data/game-history.model';
import { SgfParserService } from '../sgf/sgf-parser.service';
import { buildExerciseLine, UnreadableExerciseError, type ExerciseLine } from './exercise-line';

export interface LoadedExercise {
  phase: GamePhase;
  line: ExerciseLine;
  /** Read straight from the SGF's own PB/PW/BR/WR — not a DTO field. Always Black/White, regardless of which color the user is (which can differ per phase of the same game), so the meta line's name order stays stable across exercises. */
  blackLabel: string;
  whiteLabel: string;
  /** Read from the SGF's PC field when it names OGS or DGS; '' otherwise. */
  server: string;
}

/** Chronological order — also the order "Next" steps through once inside an exercise. games_test/ convention — see module doc below. */
const PHASE_ORDER: GamePhase[] = ['opening', 'middlegame', 'endgame'];

/**
 * games_test/ mock convention: GameHistoryDto carries all three phase SGFs,
 * but there is no backend field yet saying which phase(s) hold "the biggest
 * mistake" — this tries every phase's SGF, in chronological order, and keeps
 * every one that parses into a usable exercise (skipping ones that don't).
 * This heuristic — not a contract field — goes away once the real endpoint
 * tells us which phase(s) directly.
 *
 * The result is the full "collection" of exercises for this one game — what
 * ExercisePageComponent steps through via "Next exercise." Empty if no phase
 * produced a usable exercise.
 */
export function loadExerciseCollection(dto: GameHistoryDto, sgfParser: SgfParserService): LoadedExercise[] {
  const results: LoadedExercise[] = [];
  let lastError: unknown;

  for (const phase of PHASE_ORDER) {
    const sgf = dto[phaseKey(phase)];
    if (!sgf) continue;

    try {
      const tree = sgfParser.parse(sgf);
      const line = buildExerciseLine(tree.root);
      results.push({ phase, line, ...gameInfo(tree) });
    } catch (error) {
      lastError = error;
    }
  }

  if (!results.length) {
    throw lastError ?? new UnreadableExerciseError('No phase SGF produced an exercise');
  }

  return results;
}

function phaseKey(phase: GamePhase): keyof GameHistoryDto {
  return phase === 'opening'
    ? 'openingAnalysed'
    : phase === 'middlegame'
      ? 'middlegameAnalysed'
      : 'endgameAnalysed';
}

function gameInfo(tree: GameTree): { blackLabel: string; whiteLabel: string; server: string } {
  const data = tree.root.data;
  const blackLabel = label(data['PB']?.[0], data['BR']?.[0]);
  const whiteLabel = label(data['PW']?.[0], data['WR']?.[0]);

  const pc = data['PC']?.[0] ?? '';
  const server = /ogs|online-go/i.test(pc) ? 'OGS' : /dgs|dragongoserver/i.test(pc) ? 'DGS' : '';

  return { blackLabel, whiteLabel, server };
}

function label(name?: string, rank?: string): string {
  if (!name) return '';
  return rank ? `${name} ${rank}` : name;
}
