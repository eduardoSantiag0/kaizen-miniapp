import { parse } from '@sabaki/sgf';
import { buildExerciseLine, type ExerciseLine } from './exercise-line';
import {
  canUndo,
  hintVertex,
  initExerciseState,
  playOpponentReply,
  playVertex,
  resetExercise,
  toggleHint,
  toggleZoom,
  undo,
  type ExerciseState,
} from './exercise-state';

function lineFromSgf(sgf: string): ExerciseLine {
  return buildExerciseLine(parse(sgf)[0]);
}

describe('exercise state machine', () => {
  // Black (user) to move. KataGo: W[ec] (step 1 reply), B[ed] (step 2 would-be correct).
  // Mistake (actually played): B[fc]. Distractor: B[gc].
  const twoStepLine = lineFromSgf(
    '(;FF[4]SZ[9]AB[cc]AW[gg]PL[B]' +
      '(;B[ec];W[fc];B[ed];W[fd])' + // KataGo's line
      '(;B[fc])' + // the mistake
      '(;B[gc]))'
  );

  it('initializes at step 1 in play phase on the setup board', () => {
    const state = initExerciseState(twoStepLine);
    expect(state.phase).toBe('play');
    expect(state.step).toBe(1);
    expect(state.totalSteps).toBe(2);
    expect(state.board.get([2, 2])).toBe(1); // cc setup stone preserved
  });

  it('flags a dashed illegal ring for suicide, without placing anything', () => {
    // Surround [4,4] (ee) on all four sides with white so playing black there is self-capture.
    const sgf =
      '(;FF[4]SZ[9]AB[cc]AW[de][fe][ed][ef]PL[B]' +
      '(;B[ee])' +
      '(;B[ff]))';
    const line = lineFromSgf(sgf);
    const state = initExerciseState(line);

    const tapped = playVertex(state, line, [4, 4]); // ee: surrounded, suicide
    expect(tapped.illegal?.reason).toBe('suicide');
    expect(tapped.board.get([4, 4])).toBe(0);
    expect(tapped.phase).toBe('play');
  });

  it('plays a legal move immediately, with no preview/confirm step', () => {
    let state = initExerciseState(twoStepLine);
    state = playVertex(state, twoStepLine, [4, 2]); // ec, correct

    expect(state.board.get([4, 2])).toBe(1);
  });

  it('treats a legal move not at the branch point distinctly from the mistake', () => {
    let state = initExerciseState(twoStepLine);
    state = playVertex(state, twoStepLine, [6, 2]); // gc, a plain distractor

    expect(state.phase).toBe('wrong');
    expect(state.wrongMove?.reason).toBe('otherMove');
  });

  it('flags the specific "you played this in the game" wrong move', () => {
    let state = initExerciseState(twoStepLine);
    state = playVertex(state, twoStepLine, [5, 2]); // fc, the mistake

    expect(state.phase).toBe('wrong');
    expect(state.wrongMove?.reason).toBe('mistakeMove');
    expect(state.board.get([5, 2])).toBe(1); // the stone stays on the board
  });

  it('undo from "wrong" reverts to the position before the bad move, same step', () => {
    let state = initExerciseState(twoStepLine);
    state = playVertex(state, twoStepLine, [5, 2]); // fc, wrong
    expect(canUndo(state)).toBe(true);

    state = undo(state, twoStepLine);

    expect(state.phase).toBe('play');
    expect(state.step).toBe(1);
    expect(state.board.get([5, 2])).toBe(0);
  });

  it('plays the correct move, enters reply phase, then auto-plays the opponent and advances the step', () => {
    let state = initExerciseState(twoStepLine);
    state = playVertex(state, twoStepLine, [4, 2]); // ec, correct

    expect(state.phase).toBe('reply');
    expect(state.board.get([4, 2])).toBe(1);
    expect(state.turnSign).toBe(-1); // opponent's colour while replying

    state = playOpponentReply(state, twoStepLine);
    expect(state.phase).toBe('play');
    expect(state.step).toBe(2);
    expect(state.board.get([5, 2])).toBe(-1); // fc, the reply
    expect(state.turnSign).toBe(1);
  });

  it('reaches done after the final correct move of the line', () => {
    let state = initExerciseState(twoStepLine);
    state = playVertex(state, twoStepLine, [4, 2]);
    state = playOpponentReply(state, twoStepLine);
    state = playVertex(state, twoStepLine, [4, 3]); // ed, final correct move

    expect(state.phase).toBe('done');
  });

  it('cannot undo once the line is "done" (Tools is unmounted by then)', () => {
    let state = initExerciseState(twoStepLine);
    state = playVertex(state, twoStepLine, [4, 2]);
    state = playOpponentReply(state, twoStepLine);
    state = playVertex(state, twoStepLine, [4, 3]); // ed, final correct move
    expect(state.phase).toBe('done');

    expect(canUndo(state)).toBe(false);
    expect(undo(state, twoStepLine)).toBe(state); // no-op, same reference
  });

  it('undo from "play" (after a reply) removes the previous correct move and the opponent reply, back one step', () => {
    let state = initExerciseState(twoStepLine);
    state = playVertex(state, twoStepLine, [4, 2]); // ec, correct
    state = playOpponentReply(state, twoStepLine); // fc, step becomes 2
    expect(state.step).toBe(2);

    state = undo(state, twoStepLine);

    expect(state.phase).toBe('play');
    expect(state.step).toBe(1);
    expect(state.board.get([4, 2])).toBe(0); // ec removed
    expect(state.board.get([5, 2])).toBe(0); // fc (the reply) removed too
  });

  it('cannot undo a fresh exercise (nothing played yet)', () => {
    const state = initExerciseState(twoStepLine);
    expect(canUndo(state)).toBe(false);
    expect(undo(state, twoStepLine)).toBe(state); // no-op, same reference
  });

  it('cannot undo mid opponent-reply (board is locked)', () => {
    let state = initExerciseState(twoStepLine);
    state = playVertex(state, twoStepLine, [4, 2]);
    expect(state.phase).toBe('reply');
    expect(canUndo(state)).toBe(false);
  });

  it('resolves captures through GoBoard.makeMove when a correct move captures a stone', () => {
    // A lone white stone at ee ([4,4]) is surrounded on 3 sides by black; its last
    // liberty is ef ([4,5]), which is also KataGo's recommended first move here.
    const captureSgf = '(;FF[4]SZ[9]AB[de][fe][ed]AW[ee]PL[B](;B[ef])(;B[bb]))';
    const line = lineFromSgf(captureSgf);

    let state = initExerciseState(line);
    state = playVertex(state, line, [4, 5]); // ef

    expect(state.board.get([4, 4])).toBe(0); // white stone captured, point now empty
    expect(state.board.get([4, 5])).toBe(1); // black's capturing stone
  });

  it('resets to the initial state', () => {
    let state = initExerciseState(twoStepLine);
    state = playVertex(state, twoStepLine, [4, 2]);

    const reset = resetExercise(twoStepLine);
    expect(reset.phase).toBe('play');
    expect(reset.step).toBe(1);
    expect(reset.board.get([4, 2])).toBe(0);
  });

  it('toggles hint and reports the next correct vertex while on', () => {
    let state = initExerciseState(twoStepLine);
    expect(hintVertex(state, twoStepLine)).toBeNull();

    state = toggleHint(state);
    expect(state.hintOn).toBe(true);
    expect(hintVertex(state, twoStepLine)).toEqual([4, 2]); // ec
  });

  it('toggles the zoom window flag, defaulting to the full board', () => {
    let state = initExerciseState(twoStepLine);
    expect(state.zoomedIn).toBe(false);
    state = toggleZoom(state);
    expect(state.zoomedIn).toBe(true);
  });

  it('turns hint off once the line completes', () => {
    let state = initExerciseState(twoStepLine);
    state = toggleHint(state);
    state = playVertex(state, twoStepLine, [4, 2]);
    state = playOpponentReply(state, twoStepLine);
    state = playVertex(state, twoStepLine, [4, 3]);

    expect(state.phase).toBe('done');
    expect(state.hintOn).toBe(false);
  });
});
