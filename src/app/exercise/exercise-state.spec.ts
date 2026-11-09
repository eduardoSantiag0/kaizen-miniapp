import { parse } from '@sabaki/sgf';
import { buildExerciseLine, type ExerciseLine } from './exercise-line';
import {
  cancelPreview,
  confirmMove,
  hintVertex,
  initExerciseState,
  playOpponentReply,
  resetExercise,
  tapVertex,
  toggleHint,
  toggleZoom,
  tryAgain,
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

  it('flags a dashed illegal ring for suicide without creating a preview', () => {
    // Surround [4,4] (ee) on all four sides with white so playing black there is self-capture.
    const sgf =
      '(;FF[4]SZ[9]AB[cc]AW[de][fe][ed][ef]PL[B]' +
      '(;B[ee])' +
      '(;B[ff]))';
    const line = lineFromSgf(sgf);
    const state = initExerciseState(line);

    const tapped = tapVertex(state, line, [4, 4]); // ee: surrounded, suicide
    expect(tapped.illegal?.reason).toBe('suicide');
    expect(tapped.preview).toBeNull();
  });

  it('previews a legal move, and Cancel clears it without touching the board', () => {
    let state = initExerciseState(twoStepLine);
    state = tapVertex(state, twoStepLine, [4, 2]); // ec
    expect(state.preview).toEqual([4, 2]);

    state = cancelPreview(state);
    expect(state.preview).toBeNull();
    expect(state.board.get([4, 2])).toBe(0);
  });

  it('treats a legal move not at the branch point distinctly from the mistake', () => {
    let state = initExerciseState(twoStepLine);
    state = tapVertex(state, twoStepLine, [6, 2]); // gc, a plain distractor
    state = confirmMove(state, twoStepLine);

    expect(state.phase).toBe('wrong');
    expect(state.wrongMove?.reason).toBe('otherMove');
  });

  it('flags the specific "you played this in the game" wrong move', () => {
    let state = initExerciseState(twoStepLine);
    state = tapVertex(state, twoStepLine, [5, 2]); // fc, the mistake
    state = confirmMove(state, twoStepLine);

    expect(state.phase).toBe('wrong');
    expect(state.wrongMove?.reason).toBe('mistakeMove');
    expect(state.board.get([5, 2])).toBe(1); // the stone stays on the board
  });

  it('"Try again" reverts to the position before the wrong move, same step', () => {
    let state = initExerciseState(twoStepLine);
    state = tapVertex(state, twoStepLine, [5, 2]);
    state = confirmMove(state, twoStepLine);
    state = tryAgain(state, twoStepLine);

    expect(state.phase).toBe('play');
    expect(state.step).toBe(1);
    expect(state.board.get([5, 2])).toBe(0);
  });

  it('plays the correct move, enters reply phase, then auto-plays the opponent and advances the step', () => {
    let state = initExerciseState(twoStepLine);
    state = tapVertex(state, twoStepLine, [4, 2]); // ec, correct
    state = confirmMove(state, twoStepLine);

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
    state = tapVertex(state, twoStepLine, [4, 2]);
    state = confirmMove(state, twoStepLine);
    state = playOpponentReply(state, twoStepLine);

    state = tapVertex(state, twoStepLine, [4, 3]); // ed, final correct move
    state = confirmMove(state, twoStepLine);

    expect(state.phase).toBe('done');
  });

  it('resolves captures through GoBoard.makeMove when a correct move captures a stone', () => {
    // A lone white stone at ee ([4,4]) is surrounded on 3 sides by black; its last
    // liberty is ef ([4,5]), which is also KataGo's recommended first move here.
    const captureSgf = '(;FF[4]SZ[9]AB[de][fe][ed]AW[ee]PL[B](;B[ef])(;B[bb]))';
    const line = lineFromSgf(captureSgf);

    let state = initExerciseState(line);
    state = tapVertex(state, line, [4, 5]); // ef
    state = confirmMove(state, line);

    expect(state.board.get([4, 4])).toBe(0); // white stone captured, point now empty
    expect(state.board.get([4, 5])).toBe(1); // black's capturing stone
  });

  it('resets to the initial state', () => {
    let state = initExerciseState(twoStepLine);
    state = tapVertex(state, twoStepLine, [4, 2]);
    state = confirmMove(state, twoStepLine);

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

  it('toggles the zoom window flag', () => {
    let state = initExerciseState(twoStepLine);
    expect(state.zoomedIn).toBe(true);
    state = toggleZoom(state);
    expect(state.zoomedIn).toBe(false);
  });

  it('turns hint off once the line completes', () => {
    let state = initExerciseState(twoStepLine);
    state = toggleHint(state);
    state = tapVertex(state, twoStepLine, [4, 2]);
    state = confirmMove(state, twoStepLine);
    state = playOpponentReply(state, twoStepLine);
    state = tapVertex(state, twoStepLine, [4, 3]);
    state = confirmMove(state, twoStepLine);

    expect(state.phase).toBe('done');
    expect(state.hintOn).toBe(false);
  });
});
