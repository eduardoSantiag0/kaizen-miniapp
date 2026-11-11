import { SgfParserService } from '../sgf/sgf-parser.service';
import { loadExerciseCollection } from './exercise-source';
import type { GameHistoryDto } from '../data/game-history.model';

describe('loadExerciseCollection', () => {
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
      blackPlayer: null,
      whitePlayer: null,
      gameRank: null,
      ...overrides,
    };
  }

  it('returns every phase with a branch point, in chronological order, not just the first', () => {
    const result = loadExerciseCollection(
      dto({ middlegameAnalysed: branchingSgf, openingAnalysed: branchingSgf, endgameAnalysed: branchingSgf }),
      sgfParser
    );
    expect(result.map((r) => r.phase)).toEqual(['opening', 'middlegame', 'endgame']);
  });

  it('skips phases with no branch point, keeping only the ones that build', () => {
    const result = loadExerciseCollection(dto({ openingAnalysed: flatSgf, endgameAnalysed: branchingSgf }), sgfParser);
    expect(result.map((r) => r.phase)).toEqual(['endgame']);
  });

  it('reads both players and the server from the SGF game-info properties', () => {
    const [result] = loadExerciseCollection(dto({ middlegameAnalysed: branchingSgf }), sgfParser);
    expect(result.blackLabel).toBe('alice 5k');
    expect(result.whiteLabel).toBe('bob 2k');
    expect(result.server).toBe('OGS');
  });

  it('keeps Black/White order regardless of which color the user plays, so it stays stable across phases', () => {
    // Same players, but here PL[W] makes the user White (bob) instead of Black (alice).
    const sgfUserIsWhite =
      '(;FF[4]PC[OGS: https://online-go.com/game/1]PB[alice]BR[5k]PW[bob]WR[2k]SZ[9]PL[W]' +
      '(;W[ec])(;W[fc]))';
    const [result] = loadExerciseCollection(dto({ middlegameAnalysed: sgfUserIsWhite }), sgfParser);
    expect(result.blackLabel).toBe('alice 5k');
    expect(result.whiteLabel).toBe('bob 2k');
  });

  it('throws when no phase SGF has a usable branch point', () => {
    expect(() => loadExerciseCollection(dto({ openingAnalysed: flatSgf }), sgfParser)).toThrow();
  });

  it('throws when every phase is null', () => {
    expect(() => loadExerciseCollection(dto(), sgfParser)).toThrow();
  });
});
