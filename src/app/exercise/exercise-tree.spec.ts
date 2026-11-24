import { parse } from '@sabaki/sgf';
import { buildExerciseTree, UnreadableExerciseError } from './exercise-tree';

describe('buildExerciseTree', () => {
  it('reads setup stones, user colour and every sibling at the branch point as its own variant', () => {
    const sgf =
      '(;FF[4]SZ[19]AB[dd][pp]AW[dp][pd]PL[W]' +
      '(;W[je];B[ie];W[id];B[he])' + // [0] KataGo's best candidate
      '(;W[ro];B[qo])' + // [1] another candidate
      '(;W[an];B[ar])' + // [2] another candidate
      '(;W[cf];B[ce]))'; // [3] another candidate
    const root = parse(sgf)[0];

    const tree = buildExerciseTree(root);

    expect(tree.boardSize).toBe(19);
    expect(tree.userSign).toBe(-1); // PL[W]
    expect(tree.opponentSign).toBe(1);
    expect(tree.setupBoard.get([3, 3])).toBe(1); // dd, AB
    expect(tree.setupBoard.get([15, 15])).toBe(1); // pp, AB
    expect(tree.setupBoard.get([3, 15])).toBe(-1); // dp, AW
    expect(tree.setupBoard.get([15, 3])).toBe(-1); // pd, AW

    expect(tree.variants.length).toBe(4);
    expect(tree.variants[0].plies.map((p) => p.vertex)).toEqual([
      [9, 4], // je
      [8, 4], // ie
      [8, 3], // id
      [7, 4], // he
    ]);
    expect(tree.variants[1].plies.map((p) => p.vertex)).toEqual([
      [17, 14], // ro
      [16, 14], // qo
    ]);
    expect(tree.variants[2].plies.map((p) => p.vertex)).toEqual([
      [0, 13], // an
      [0, 17], // ar
    ]);
    expect(tree.variants[3].plies.map((p) => p.vertex)).toEqual([
      [2, 5], // cf
      [2, 4], // ce
    ]);
    // Root IS the branch point here — no move chain before it.
    expect(tree.previousMove).toBeNull();
  });

  it('caps each variant at 11 plies (1 initial move + the max Continuation Depth of 10)', () => {
    const twelvePlies =
      ';W[aa];B[ab];W[ac];B[ad];W[ae];B[af];W[ag];B[ah];W[ai];B[aj];W[ak];B[al]';
    const sgf = `(;FF[4]SZ[19]PL[W](${twelvePlies})(;W[za])(;W[zb]))`;
    const root = parse(sgf)[0];

    const tree = buildExerciseTree(root);
    expect(tree.variants[0].plies.length).toBe(11);
    expect(tree.previousMove).toBeNull();
  });

  it('throws UnreadableExerciseError when there is no branch point', () => {
    const sgf = '(;FF[4]SZ[19]AB[dd];W[pp];B[dp])';
    const root = parse(sgf)[0];

    expect(() => buildExerciseTree(root)).toThrowError(UnreadableExerciseError);
  });

  it('defaults to black when PL is absent', () => {
    const sgf = '(;FF[4]SZ[9](;B[ee])(;B[cc]))';
    const root = parse(sgf)[0];

    const tree = buildExerciseTree(root);
    expect(tree.userSign).toBe(1);
    expect(tree.opponentSign).toBe(-1);
    expect(tree.previousMove).toBeNull();
  });

  it('matches every real games_test/ fixture today: root is the branch point directly, so previousMove is null and setupBoard is exactly the AB/AW setup (no latent stones from a chain that does not exist)', () => {
    // Same shape as the real gakutakunokumekriff_*.sgf fixtures: root's own properties
    // (AB/AW/PL) are immediately followed by the branch's sibling variations, no
    // single-child chain in between.
    const sgf =
      '(;FF[4]SZ[9]AB[cc]AW[gg][hi][ih]PL[B](;B[ec];W[fc];B[ed];W[fd])(;B[fc])(;B[gc]))';
    const root = parse(sgf)[0];

    const tree = buildExerciseTree(root);
    expect(tree.previousMove).toBeNull();
    expect(tree.setupBoard.get([2, 2])).toBe(1); // cc, AB
    expect(tree.setupBoard.get([6, 6])).toBe(-1); // gg, AW
    // Nothing beyond the AB/AW setup is on the board — confirms the preceding-moves
    // replay is a true no-op when there is no chain to replay.
    expect(tree.setupBoard.get([4, 2])).toBe(0); // ec — not yet played
  });

  it('replays a real preceding-move chain onto setupBoard and reports it as previousMove', () => {
    // root -> single-child (;W[gc]) -> branch point, 3 siblings. W[gc] is the real
    // game's own last move leading into this position, before any variant starts.
    const sgf = '(;FF[4]SZ[9]AB[cc]PL[B];W[gc](;B[ec];W[fc])(;B[fc])(;B[hc]))';
    const root = parse(sgf)[0];

    const tree = buildExerciseTree(root);

    expect(tree.previousMove).toEqual({ sign: -1, vertex: [6, 2] }); // gc, White
    expect(tree.setupBoard.get([6, 2])).toBe(-1); // the replayed stone is actually on the board
    expect(tree.setupBoard.get([2, 2])).toBe(1); // cc, AB — still there too
    expect(tree.variants[0].plies.map((p) => p.vertex)).toEqual([
      [4, 2], // ec
      [5, 2], // fc
    ]);
    expect(tree.variants[1].plies.map((p) => p.vertex)).toEqual([[5, 2]]); // fc, the second sibling
    expect(tree.variants[2].plies.map((p) => p.vertex)).toEqual([[7, 2]]); // hc, the third sibling
  });
});
