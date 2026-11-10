import { SgfParserService } from '../sgf/sgf-parser.service';
import { deriveGameListEntry } from './game-list-entry';
import type { GameHistoryDto } from '../data/game-history.model';

describe('deriveGameListEntry', () => {
  const sgfParser = new SgfParserService();

  function dto(overrides: Partial<GameHistoryDto> = {}): GameHistoryDto {
    return {
      id: 'game-1',
      correlationId: 'corr-1',
      openingAnalysed: null,
      middlegameAnalysed: null,
      endgameAnalysed: null,
      blackPlayer: null,
      whitePlayer: null,
      gameRank: null,
      ...overrides,
    };
  }

  const exerciseSgf =
    '(;FF[4]SZ[19]AB[dd][pp]AW[dp][pd]PB[the_user]PW[kitsune77]BR[4k]WR[3k]PC[OGS: https://online-go.com/x]DT[2026-11-08]RE[B+R]PL[B]' +
    ';B[qd];W[cp];B[nq]' + // 3 linear moves before the branch point
    '(;B[je];W[ie])' + // [0] KataGo's line
    '(;B[ro];W[qo])' + // [1] the mistake
    '(;B[an];W[ar]))'; // [2] distractor

  it('status "done": a phase SGF has a branch point — move number counts the linear moves before it', () => {
    const entry = deriveGameListEntry(dto({ middlegameAnalysed: exerciseSgf }), sgfParser);

    expect(entry.status).toBe('done');
    expect(entry.mistakeMoveNumber).toBe(3); // qd, cp, nq precede the branch
    expect(entry.boardSize).toBe(19);
    expect(entry.server).toBe('OGS');
    expect(entry.date).toBe('2026-11-08');
    expect(entry.result).toBe('B+R');
  });

  it('attributes name/rank to the opponent (not the user) by PL[] at the root', () => {
    const entry = deriveGameListEntry(dto({ middlegameAnalysed: exerciseSgf }), sgfParser);

    expect(entry.userSign).toBe(1); // PL[B]
    expect(entry.opponentName).toBe('kitsune77'); // PW — the non-user side
    expect(entry.opponentRank).toBe('3k'); // WR — the non-user side's rank
    expect(entry.won).toBe(true); // RE[B+R], user is black
  });

  it('status "running": a phase SGF exists but has no branch point', () => {
    const linearSgf = '(;FF[4]SZ[19]PL[B];B[pd];W[dp];B[pq];W[dd])';
    const entry = deriveGameListEntry(dto({ openingAnalysed: linearSgf }), sgfParser);

    expect(entry.status).toBe('running');
    expect(entry.mistakeMoveNumber).toBeNull();
  });

  it('status "done" (clean): all three phase fields are null means analysis finished and found nothing, not "not started" — the backend only ever writes a row once analysis is complete, falls back to the DTO\'s own player fields', () => {
    const entry = deriveGameListEntry(
      dto({ whitePlayer: 'hoshi_no_go', gameRank: '3d' }),
      sgfParser
    );

    expect(entry.status).toBe('done');
    expect(entry.mistakeMoveNumber).toBeNull();
    expect(entry.moves).toBe(0);
    expect(entry.userSign).toBe(1); // no PL[] available — defaults to black
    expect(entry.opponentName).toBe('hoshi_no_go'); // userSign black -> opponent is white
  });

  it('counts moves along the first-child chain, independent of the branch point', () => {
    const entry = deriveGameListEntry(dto({ endgameAnalysed: exerciseSgf }), sgfParser);

    // 3 linear moves + the root's own [0] branch (je) — walkMainLine-style
    // traversal always follows children[0], so it continues into the KataGo branch.
    expect(entry.moves).toBe(5);
  });

  it('falls back through phases in middlegame, opening, endgame priority order, same as loadExercise', () => {
    const entry = deriveGameListEntry(
      dto({ middlegameAnalysed: 'not valid sgf at all [[[', openingAnalysed: exerciseSgf }),
      sgfParser
    );

    expect(entry.status).toBe('done');
    expect(entry.server).toBe('OGS'); // only readable from the opening phase, confirming it was the one actually used
  });
});
