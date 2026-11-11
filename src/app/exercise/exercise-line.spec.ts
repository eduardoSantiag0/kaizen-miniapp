import { parse } from '@sabaki/sgf';
import { buildExerciseLine, UnreadableExerciseError } from './exercise-line';

describe('buildExerciseLine', () => {
  it('reads setup stones, user colour and the mock branch convention', () => {
    const sgf =
      '(;FF[4]SZ[19]AB[dd][pp]AW[dp][pd]PL[W]' +
      '(;W[je];B[ie];W[id];B[he])' + // [0] KataGo's line
      '(;W[ro];B[qo])' + // [1] the move actually played — the mistake
      '(;W[an];B[ar])' + // [2] distractor
      '(;W[cf];B[ce]))'; // [3] distractor
    const root = parse(sgf)[0];

    const line = buildExerciseLine(root);

    expect(line.boardSize).toBe(19);
    expect(line.userSign).toBe(-1); // PL[W]
    expect(line.opponentSign).toBe(1);
    expect(line.setupBoard.get([3, 3])).toBe(1); // dd, AB
    expect(line.setupBoard.get([15, 15])).toBe(1); // pp, AB
    expect(line.setupBoard.get([3, 15])).toBe(-1); // dp, AW
    expect(line.setupBoard.get([15, 3])).toBe(-1); // pd, AW

    expect(line.kataGoLine.map((p) => p.vertex)).toEqual([
      [9, 4], // je
      [8, 4], // ie
      [8, 3], // id
      [7, 4], // he
    ]);
    expect(line.mistakeVertex).toEqual([17, 14]); // ro
    expect(line.distractorVertices).toEqual([
      [0, 13], // an
      [2, 5], // cf
    ]);
    expect(line.totalSteps).toBe(2);
    // Root IS the branch point here — no move chain before it.
    expect(line.previousMove).toBeNull();
  });

  it('caps the KataGo line at 9 plies (5 user moves + 4 replies)', () => {
    const tenPlies =
      ';W[aa];B[ab];W[ac];B[ad];W[ae];B[af];W[ag];B[ah];W[ai];B[aj]';
    const sgf = `(;FF[4]SZ[19]PL[W](${tenPlies})(;W[za])(;W[zb]))`;
    const root = parse(sgf)[0];

    const line = buildExerciseLine(root);
    expect(line.kataGoLine.length).toBe(9);
    expect(line.totalSteps).toBe(5);
    expect(line.previousMove).toBeNull();
  });

  it('throws UnreadableExerciseError when there is no branch point', () => {
    const sgf = '(;FF[4]SZ[19]AB[dd];W[pp];B[dp])';
    const root = parse(sgf)[0];

    expect(() => buildExerciseLine(root)).toThrowError(UnreadableExerciseError);
  });

  it('defaults to black when PL is absent', () => {
    const sgf = '(;FF[4]SZ[9](;B[ee])(;B[cc]))';
    const root = parse(sgf)[0];

    const line = buildExerciseLine(root);
    expect(line.userSign).toBe(1);
    expect(line.opponentSign).toBe(-1);
    expect(line.previousMove).toBeNull();
  });

  it('matches every real games_test/ fixture today: root is the branch point directly, so previousMove is null and setupBoard is exactly the AB/AW setup (no latent stones from a chain that does not exist)', () => {
    // Same shape as the real gakutakunokumekriff_*.sgf fixtures: root's own properties
    // (AB/AW/PL) are immediately followed by the branch's sibling variations, no
    // single-child chain in between.
    const sgf =
      '(;FF[4]SZ[9]AB[cc]AW[gg][hi][ih]PL[B](;B[ec];W[fc];B[ed];W[fd])(;B[fc])(;B[gc]))';
    const root = parse(sgf)[0];

    const line = buildExerciseLine(root);
    expect(line.previousMove).toBeNull();
    expect(line.setupBoard.get([2, 2])).toBe(1); // cc, AB
    expect(line.setupBoard.get([6, 6])).toBe(-1); // gg, AW
    // Nothing beyond the AB/AW setup is on the board — confirms the preceding-moves
    // replay is a true no-op when there is no chain to replay.
    expect(line.setupBoard.get([4, 2])).toBe(0); // ec — not yet played
  });

  it('replays a real preceding-move chain onto setupBoard and reports it as previousMove', () => {
    // root -> single-child (;W[gc]) -> branch point, 3 siblings. W[gc] is the real
    // game's own last move leading into this position, before KataGo's line even starts.
    const sgf = '(;FF[4]SZ[9]AB[cc]PL[B];W[gc](;B[ec];W[fc])(;B[fc])(;B[hc]))';
    const root = parse(sgf)[0];

    const line = buildExerciseLine(root);

    expect(line.previousMove).toEqual({ sign: -1, vertex: [6, 2] }); // gc, White
    expect(line.setupBoard.get([6, 2])).toBe(-1); // the replayed stone is actually on the board
    expect(line.setupBoard.get([2, 2])).toBe(1); // cc, AB — still there too
    expect(line.kataGoLine.map((p) => p.vertex)).toEqual([
      [4, 2], // ec
      [5, 2], // fc
    ]);
    expect(line.mistakeVertex).toEqual([5, 2]); // fc, the second sibling
  });
});
