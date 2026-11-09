import { SgfParserService } from '../sgf/sgf-parser.service';
import { loadExercise } from './exercise-source';
import type { GameHistoryDto } from '../data/game-history.model';

describe('loadExercise', () => {
  const sgfParser = new SgfParserService();
  const branchingSgf =
    '(;FF[4]PC[OGS: https://online-go.com/game/1]PB[alice]BR[5k]PW[bob]WR[2k]SZ[9]PL[B]' +
    '(;B[ec])(;B[fc]))';
  const flatSgf = '(;FF[4]SZ[9];B[cc];W[gg])';

  function dto(overrides: Partial<GameHistoryDto> = {}): GameHistoryDto {
    return {
      id: 'g1',
      correlationId: 'c1',
      openingAnalysed: null,
      middlegameAnalysed: null,
      endgameAnalysed: null,
      ...overrides,
    };
  }

  it('prefers the middlegame phase when it has a branch point', () => {
    const result = loadExercise(dto({ middlegameAnalysed: branchingSgf, openingAnalysed: branchingSgf }), sgfParser);
    expect(result.phase).toBe('middlegame');
  });

  it('falls back to opening, then endgame, when earlier phases have no branch point', () => {
    const result = loadExercise(dto({ openingAnalysed: flatSgf, endgameAnalysed: branchingSgf }), sgfParser);
    expect(result.phase).toBe('endgame');
  });

  it('reads the opponent (the other colour) and server from the SGF game-info properties', () => {
    // branchingSgf has PL[B], so the user is Black (alice) and the opponent is White (bob).
    const result = loadExercise(dto({ middlegameAnalysed: branchingSgf }), sgfParser);
    expect(result.opponentLabel).toBe('bob 2k');
    expect(result.server).toBe('OGS');
  });

  it('throws when no phase SGF has a usable branch point', () => {
    expect(() => loadExercise(dto({ openingAnalysed: flatSgf }), sgfParser)).toThrow();
  });

  it('throws when every phase is null', () => {
    expect(() => loadExercise(dto(), sgfParser)).toThrow();
  });
});
