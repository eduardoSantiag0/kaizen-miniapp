import { parse } from '@sabaki/sgf';
import { buildExerciseTree, type ExerciseTree } from './exercise-tree';
import {
  canUndo,
  goDeeper,
  hasMoreToGoDeeper,
  hintVertex,
  hintVertices,
  initExerciseState,
  playOpponentReply,
  playVertex,
  resetExercise,
  resumeExerciseState,
  toggleHint,
  toggleZoom,
  undo,
} from './exercise-state';

function treeFromSgf(sgf: string): ExerciseTree {
  return buildExerciseTree(parse(sgf)[0]);
}

describe('exercise state machine', () => {
  // Black (user) to move. Two candidate variants: B[ec];W[fc];B[ed];W[fd] (variant 0,
  // 2 steps) and B[gc] (variant 1, 1 step, no reply).
  const twoVariantTree = treeFromSgf(
    '(;FF[4]SZ[9]AB[cc]AW[gg]PL[B]' +
      '(;B[ec];W[fc];B[ed];W[fd])' + // variant 0
      '(;B[gc]))' // variant 1
  );

  it('initializes at step 1 in play phase, no variant picked yet, on the setup board', () => {
    const state = initExerciseState(twoVariantTree);
    expect(state.phase).toBe('play');
    expect(state.selectedVariant).toBeNull();
    expect(state.step).toBe(1);
    expect(state.totalSteps).toBe(0);
    expect(state.board.get([2, 2])).toBe(1); // cc setup stone preserved
  });

  it('flags a dashed illegal ring for suicide, without placing anything', () => {
    // Surround [4,4] (ee) on all four sides with white so playing black there is self-capture.
    const sgf =
      '(;FF[4]SZ[9]AB[cc]AW[de][fe][ed][ef]PL[B]' +
      '(;B[ee])' +
      '(;B[ff]))';
    const tree = treeFromSgf(sgf);
    const state = initExerciseState(tree);

    const tapped = playVertex(state, tree, [4, 4]); // ee: surrounded, suicide
    expect(tapped.illegal?.reason).toBe('suicide');
    expect(tapped.board.get([4, 4])).toBe(0);
    expect(tapped.phase).toBe('play');
  });

  it('plays a legal first move matching variant 0 immediately, with no preview/confirm step', () => {
    let state = initExerciseState(twoVariantTree);
    state = playVertex(state, twoVariantTree, [4, 2]); // ec, variant 0's first move

    expect(state.board.get([4, 2])).toBe(1);
    expect(state.selectedVariant).toBe(0);
  });

  it('accepts variant 1 just as well as variant 0 — any offered candidate is correct', () => {
    let state = initExerciseState(twoVariantTree);
    state = playVertex(state, twoVariantTree, [6, 2]); // gc, variant 1's only move

    expect(state.selectedVariant).toBe(1);
    expect(state.phase).toBe('done'); // variant 1 has no reply
  });

  it('treats a move matching no variant as "not evaluated"', () => {
    let state = initExerciseState(twoVariantTree);
    state = playVertex(state, twoVariantTree, [1, 1]); // bb, not offered by either variant

    expect(state.phase).toBe('wrong');
    expect(state.wrongMove?.reason).toBe('notEvaluated');
    expect(state.selectedVariant).toBeNull();
  });

  it('undo from "wrong" at the first move clears the board and keeps no variant selected', () => {
    let state = initExerciseState(twoVariantTree);
    state = playVertex(state, twoVariantTree, [1, 1]); // bb, wrong
    expect(canUndo(state)).toBe(true);

    state = undo(state, twoVariantTree);

    expect(state.phase).toBe('play');
    expect(state.selectedVariant).toBeNull();
    expect(state.board.get([1, 1])).toBe(0);
  });

  it('plays the correct move, enters reply phase, then auto-plays the opponent and advances the step', () => {
    let state = initExerciseState(twoVariantTree);
    state = playVertex(state, twoVariantTree, [4, 2]); // ec, variant 0

    expect(state.phase).toBe('reply');
    expect(state.board.get([4, 2])).toBe(1);
    expect(state.turnSign).toBe(-1); // opponent's colour while replying

    state = playOpponentReply(state, twoVariantTree);
    expect(state.phase).toBe('play');
    expect(state.step).toBe(2);
    expect(state.board.get([5, 2])).toBe(-1); // fc, the reply
    expect(state.turnSign).toBe(1);
  });

  it('reaches done after the final correct move of the chosen variant', () => {
    let state = initExerciseState(twoVariantTree);
    state = playVertex(state, twoVariantTree, [4, 2]);
    state = playOpponentReply(state, twoVariantTree);
    state = playVertex(state, twoVariantTree, [4, 3]); // ed, final correct move

    expect(state.phase).toBe('done');
  });

  it('cannot undo once the line is "done" (Tools is unmounted by then)', () => {
    let state = initExerciseState(twoVariantTree);
    state = playVertex(state, twoVariantTree, [4, 2]);
    state = playOpponentReply(state, twoVariantTree);
    state = playVertex(state, twoVariantTree, [4, 3]); // ed, final correct move
    expect(state.phase).toBe('done');

    expect(canUndo(state)).toBe(false);
    expect(undo(state, twoVariantTree)).toBe(state); // no-op, same reference
  });

  it('undo from "play" (after a reply) removes the previous correct move and the opponent reply, back to step 1 with the variant still selected', () => {
    let state = initExerciseState(twoVariantTree);
    state = playVertex(state, twoVariantTree, [4, 2]); // ec, correct, variant 0
    state = playOpponentReply(state, twoVariantTree); // fc, step becomes 2
    expect(state.step).toBe(2);

    state = undo(state, twoVariantTree);

    expect(state.phase).toBe('play');
    expect(state.step).toBe(1);
    expect(state.selectedVariant).toBe(0);
    expect(state.board.get([4, 2])).toBe(0); // ec removed
    expect(state.board.get([5, 2])).toBe(0); // fc (the reply) removed too
  });

  it('undo again from step 1 (variant still selected, nothing else to remove) un-picks the variant entirely', () => {
    let state = initExerciseState(twoVariantTree);
    state = playVertex(state, twoVariantTree, [4, 2]); // ec, correct, picks variant 0
    state = playOpponentReply(state, twoVariantTree); // step becomes 2
    state = undo(state, twoVariantTree); // back to step 1, variant 0 still selected
    expect(state.step).toBe(1);
    expect(state.selectedVariant).toBe(0);

    state = undo(state, twoVariantTree);

    expect(state.selectedVariant).toBeNull();
    expect(state.totalSteps).toBe(0);
    expect(state.board.get([4, 2])).toBe(0); // ec removed too
  });

  it('cannot undo a fresh exercise (nothing played yet)', () => {
    const state = initExerciseState(twoVariantTree);
    expect(canUndo(state)).toBe(false);
    expect(undo(state, twoVariantTree)).toBe(state); // no-op, same reference
  });

  it('cannot undo mid opponent-reply (board is locked)', () => {
    let state = initExerciseState(twoVariantTree);
    state = playVertex(state, twoVariantTree, [4, 2]);
    expect(state.phase).toBe('reply');
    expect(canUndo(state)).toBe(false);
  });

  it('resolves captures through GoBoard.makeMove when a correct move captures a stone', () => {
    // A lone white stone at ee ([4,4]) is surrounded on 3 sides by black; its last
    // liberty is ef ([4,5]), which is one of the offered variants' first move here.
    const captureSgf = '(;FF[4]SZ[9]AB[de][fe][ed]AW[ee]PL[B](;B[ef])(;B[bb]))';
    const tree = treeFromSgf(captureSgf);

    let state = initExerciseState(tree);
    state = playVertex(state, tree, [4, 5]); // ef

    expect(state.board.get([4, 4])).toBe(0); // white stone captured, point now empty
    expect(state.board.get([4, 5])).toBe(1); // black's capturing stone
  });

  it('resets to the initial state, clearing the selected variant', () => {
    let state = initExerciseState(twoVariantTree);
    state = playVertex(state, twoVariantTree, [4, 2]);

    const reset = resetExercise(twoVariantTree);
    expect(reset.phase).toBe('play');
    expect(reset.selectedVariant).toBeNull();
    expect(reset.step).toBe(1);
    expect(reset.board.get([4, 2])).toBe(0);
  });

  it('before any variant is picked, hint rings every variant\'s first move', () => {
    let state = initExerciseState(twoVariantTree);
    expect(hintVertices(state, twoVariantTree)).toEqual([]);

    state = toggleHint(state);
    expect(state.hintOn).toBe(true);
    expect(hintVertices(state, twoVariantTree)).toEqual([
      [4, 2], // ec, variant 0
      [6, 2], // gc, variant 1
    ]);
    // hintVertex() (single) is only meaningful once a variant is picked.
    expect(hintVertex(state, twoVariantTree)).toBeNull();
  });

  it('once a variant is picked, hint rings only the next expected move', () => {
    let state = initExerciseState(twoVariantTree);
    state = toggleHint(state);
    state = playVertex(state, twoVariantTree, [4, 2]); // ec, variant 0 -> reply
    state = playOpponentReply(state, twoVariantTree); // -> play, step 2

    expect(hintVertex(state, twoVariantTree)).toEqual([4, 3]); // ed
    expect(hintVertices(state, twoVariantTree)).toEqual([[4, 3]]);
  });

  it('toggles the zoom window flag, defaulting to the full board', () => {
    let state = initExerciseState(twoVariantTree);
    expect(state.zoomedIn).toBe(false);
    state = toggleZoom(state);
    expect(state.zoomedIn).toBe(true);
  });

  describe('goDeeper / hasMoreToGoDeeper (handoff section 7)', () => {
    // 6 plies of real data (ec/fc/ed/fd/eg/fg — 3 user moves' worth).
    const longVariantTree = treeFromSgf(
      '(;FF[4]SZ[9]AB[cc]AW[gg]PL[B](;B[ec];W[fc];B[ed];W[fd];B[eg];W[fg])(;B[gc]))'
    );

    it('is a no-op before the exercise is done', () => {
      const state = initExerciseState(longVariantTree);
      expect(goDeeper(state, longVariantTree, 11)).toBe(state);
    });

    it('reveals more of the same variant once maxPlies is raised (e.g. Continuation Depth M: 2 -> 4)', () => {
      let state = initExerciseState(longVariantTree);
      state = playVertex(state, longVariantTree, [4, 2], 3); // ec, maxPlies=3 (M=2, the minimum) -> totalSteps=2
      state = playOpponentReply(state, longVariantTree); // fc -> step 2
      state = playVertex(state, longVariantTree, [4, 3]); // ed, correct; isLastStep (2>=2) -> 'done', fd skipped
      expect(state.phase).toBe('done');
      expect(state.totalSteps).toBe(2);
      expect(state.board.get([5, 3])).toBe(0); // fd not played yet

      state = goDeeper(state, longVariantTree, 5); // M -> 4, maxPlies = 1 + 4 = 5

      expect(state.totalSteps).toBe(3); // ceil(min(5,6)/2)
      expect(state.phase).toBe('reply'); // fd (round 2's reply) was skipped — reveal it now
      expect(state.turnSign).toBe(-1);

      state = playOpponentReply(state, longVariantTree);
      expect(state.board.get([5, 3])).toBe(-1); // fd now played
      expect(state.step).toBe(3);
      expect(state.phase).toBe('play'); // user's turn for round 3 (eg)
    });

    it('is a no-op once the variant\'s real data is exhausted', () => {
      let state = initExerciseState(longVariantTree);
      state = playVertex(state, longVariantTree, [4, 2], 11); // full depth from the start -> totalSteps=3 (max for this variant)
      state = playOpponentReply(state, longVariantTree);
      state = playVertex(state, longVariantTree, [4, 3]);
      state = playOpponentReply(state, longVariantTree);
      state = playVertex(state, longVariantTree, [4, 6]); // eg, final move -> done
      expect(state.phase).toBe('done');
      expect(state.totalSteps).toBe(3);

      expect(goDeeper(state, longVariantTree, 11)).toBe(state);
      expect(hasMoreToGoDeeper(state, longVariantTree, 11)).toBe(false);
    });

    it('is a no-op when no variant was ever selected', () => {
      const state = { ...initExerciseState(longVariantTree), phase: 'done' as const };
      expect(goDeeper(state, longVariantTree, 11)).toBe(state);
      expect(hasMoreToGoDeeper(state, longVariantTree, 11)).toBe(false);
    });

    it('hasMoreToGoDeeper is true exactly when raising maxPlies would reveal something new', () => {
      let state = initExerciseState(longVariantTree);
      state = playVertex(state, longVariantTree, [4, 2], 3); // maxPlies=3 -> totalSteps=2
      state = playOpponentReply(state, longVariantTree);
      state = playVertex(state, longVariantTree, [4, 3]);
      expect(state.phase).toBe('done');

      expect(hasMoreToGoDeeper(state, longVariantTree, 5)).toBe(true); // M=4 would reveal round 3
      expect(hasMoreToGoDeeper(state, longVariantTree, 3)).toBe(false); // same depth as now — nothing new
    });
  });

  it('turns hint off once the line completes', () => {
    let state = initExerciseState(twoVariantTree);
    state = toggleHint(state);
    state = playVertex(state, twoVariantTree, [4, 2]);
    state = playOpponentReply(state, twoVariantTree);
    state = playVertex(state, twoVariantTree, [4, 3]);

    expect(state.phase).toBe('done');
    expect(state.hintOn).toBe(false);
  });

  describe('resumeExerciseState', () => {
    // 6 plies: ec, fc, ed, fd, eg, fg — long enough for a real mid-line (not yet 'done') resume.
    const longVariantTree = treeFromSgf(
      '(;FF[4]SZ[9]AB[cc]AW[gg]PL[B](;B[ec];W[fc];B[ed];W[fd];B[eg];W[fg])(;B[gc]))'
    );

    it('resumes exactly like a fresh start when no variant was picked yet', () => {
      const state = resumeExerciseState(longVariantTree, { selectedVariant: null, step: 1, currentDepth: 4 }, 5);
      expect(state).toEqual(initExerciseState(longVariantTree));
    });

    it('resumes mid-line, with the board replayed up to the saved step', () => {
      const state = resumeExerciseState(longVariantTree, { selectedVariant: 0, step: 2, currentDepth: 4 }, 5);

      expect(state.phase).toBe('play');
      expect(state.selectedVariant).toBe(0);
      expect(state.step).toBe(2);
      expect(state.totalSteps).toBe(3); // ceil(min(5, 6) / 2)
      expect(state.board.get([4, 2])).toBe(1); // ec
      expect(state.board.get([5, 2])).toBe(-1); // fc
      expect(state.board.get([4, 3])).toBe(0); // ed not played yet
      expect(state.lastMove).toEqual({ vertex: [5, 2], sign: -1 });
    });

    it('resumes already-done exercises at the Exercise Complete screen, board included', () => {
      const state = resumeExerciseState(longVariantTree, { selectedVariant: 0, step: 3, currentDepth: 4 }, 5);

      expect(state.phase).toBe('done');
      expect(state.step).toBe(3);
      expect(state.board.get([4, 6])).toBe(1); // eg, the final confirmed move
      expect(state.board.get([5, 6])).toBe(0); // fg never played — capped by maxPlies
      expect(state.lastMove).toEqual({ vertex: [4, 6], sign: 1 });
    });

    it('matches playing the line move by move, for the same saved step', () => {
      let played = initExerciseState(longVariantTree);
      played = playVertex(played, longVariantTree, [4, 2], 5); // ec
      played = playOpponentReply(played, longVariantTree); // fc, step -> 2

      const resumed = resumeExerciseState(longVariantTree, { selectedVariant: 0, step: 2, currentDepth: 4 }, 5);

      expect(resumed.board.signMap).toEqual(played.board.signMap);
      expect(resumed.step).toBe(played.step);
      expect(resumed.phase).toBe(played.phase);
    });

    it('falls back to a fresh start for an out-of-range saved variant', () => {
      const state = resumeExerciseState(longVariantTree, { selectedVariant: 99, step: 2, currentDepth: 4 }, 5);
      expect(state).toEqual(initExerciseState(longVariantTree));
    });
  });
});
