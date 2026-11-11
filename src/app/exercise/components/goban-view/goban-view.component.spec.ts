import { ComponentFixture, TestBed } from '@angular/core/testing';
import { parse } from '@sabaki/sgf';
import { GobanViewComponent } from './goban-view.component';
import { buildExerciseLine, type ExerciseLine } from '../../exercise-line';
import {
  initExerciseState,
  playOpponentReply,
  playVertex,
  resetExercise,
  undo,
  type ExerciseState,
} from '../../exercise-state';

function lineFromSgf(sgf: string): ExerciseLine {
  return buildExerciseLine(parse(sgf)[0]);
}

describe('GobanViewComponent', () => {
  let fixture: ComponentFixture<GobanViewComponent>;

  // Setup: AB[cc]AW[gg], user (Black) to move. KataGo's line: ec, fc, ed, fd.
  // The mistake (actually played): fc. A plain distractor: gc.
  // AW[hi][ih] additionally surrounds the corner ii ([8,8]) on both its liberties, so B[ii] is suicide.
  const line = lineFromSgf(
    '(;FF[4]SZ[9]AB[cc]AW[gg][hi][ih]PL[B](;B[ec];W[fc];B[ed];W[fd])(;B[fc])(;B[gc]))'
  );

  function setState(state: ExerciseState): void {
    fixture = TestBed.createComponent(GobanViewComponent);
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('line', line);
    fixture.detectChanges();
  }

  function hasMistakePoint(): boolean {
    return fixture.componentInstance
      .vertexClasses()
      .some((c) => c.className === 'kz-mistake-point' && c.vertex[0] === line.mistakeVertex![0] && c.vertex[1] === line.mistakeVertex![1]);
  }

  it('marks the historical mistake point on a fresh exercise', () => {
    setState(initExerciseState(line));
    expect(hasMistakePoint()).toBe(true);
  });

  it('keeps the marker through an illegal-tap attempt, since illegal does not touch lastMove/phase/step', () => {
    const fresh = initExerciseState(line);
    const afterIllegalTap = playVertex(fresh, line, [8, 8]); // ii, surrounded — suicide
    expect(afterIllegalTap.illegal?.reason).toBe('suicide');

    setState(afterIllegalTap);
    expect(hasMistakePoint()).toBe(true);
  });

  it('hides the marker the instant any legal move is played', () => {
    const fresh = initExerciseState(line);
    const afterCorrectMove = playVertex(fresh, line, [4, 2]); // ec, correct -> 'reply'
    expect(afterCorrectMove.phase).toBe('reply');

    setState(afterCorrectMove);
    expect(hasMistakePoint()).toBe(false);
  });

  it('hides the marker in the wrong phase', () => {
    const fresh = initExerciseState(line);
    const afterMistakeTap = playVertex(fresh, line, [5, 2]); // fc, the mistake itself -> 'wrong'
    expect(afterMistakeTap.phase).toBe('wrong');

    setState(afterMistakeTap);
    expect(hasMistakePoint()).toBe(false);
  });

  it('hides the marker in the done phase', () => {
    let state = initExerciseState(line);
    state = playVertex(state, line, [4, 2]); // ec, correct -> 'reply'
    state = playOpponentReply(state, line); // fc, opponent's reply -> back to 'play', step 2
    state = playVertex(state, line, [4, 3]); // ed, correct, final move -> 'done'
    expect(state.phase).toBe('done');

    setState(state);
    expect(hasMistakePoint()).toBe(false);
  });

  it('reappears after Reset', () => {
    const fresh = initExerciseState(line);
    const afterCorrectMove = playVertex(fresh, line, [4, 2]); // ec, correct -> marker hidden
    setState(afterCorrectMove);
    expect(hasMistakePoint()).toBe(false);

    setState(resetExercise(line));
    expect(hasMistakePoint()).toBe(true);
  });

  it('reappears after Undo-ing back to step 1', () => {
    let state = initExerciseState(line);
    state = playVertex(state, line, [4, 2]); // ec, correct -> 'reply'
    state = playOpponentReply(state, line); // fc, opponent's reply -> back to 'play', step 2

    setState(state);
    expect(hasMistakePoint()).toBe(false); // step 2, not step 1

    setState(undo(state, line));
    expect(hasMistakePoint()).toBe(true);
  });
});
