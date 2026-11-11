import { ComponentFixture, TestBed } from '@angular/core/testing';
import { parse } from '@sabaki/sgf';
import type { Vertex } from '@sabaki/shudan';
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

  it('adds no kz-last-move marker on a fresh exercise when the line has no previousMove (no regression for today\'s real fixtures)', () => {
    setState(initExerciseState(line));
    expect(line.previousMove).toBeNull();
    expect(fixture.componentInstance.vertexClasses().some((c) => c.className === 'kz-last-move')).toBe(false);
  });

  describe('previous-move marker (reuses kz-last-move, no new style)', () => {
    // root -> single-child (;W[gc]) -> branch point. W[gc] is the real game's own
    // last move leading into this position, before KataGo's line even starts.
    const previousMoveLine = lineFromSgf('(;FF[4]SZ[9]AB[cc]PL[B];W[gc](;B[ec];W[fc])(;B[fc])(;B[hc]))');

    function setPreviousMoveState(state: ExerciseState): void {
      fixture = TestBed.createComponent(GobanViewComponent);
      fixture.componentRef.setInput('state', state);
      fixture.componentRef.setInput('line', previousMoveLine);
      fixture.detectChanges();
    }

    function hasLastMoveMarkerAt(vertex: Vertex): boolean {
      return fixture.componentInstance
        .vertexClasses()
        .some((c) => c.className === 'kz-last-move' && c.vertex[0] === vertex[0] && c.vertex[1] === vertex[1]);
    }

    it('marks the real last move before the branch point on a fresh exercise', () => {
      expect(previousMoveLine.previousMove).toEqual({ sign: -1, vertex: [6, 2] }); // gc, White

      setPreviousMoveState(initExerciseState(previousMoveLine));
      expect(hasLastMoveMarkerAt([6, 2])).toBe(true);
    });

    it('disappears once the user plays', () => {
      const fresh = initExerciseState(previousMoveLine);
      // totalSteps is 1 here (kataGoLine is just ec/fc), so this correct move already
      // reaches 'done' — either way, lastMove is now set, which is all this marker checks.
      const afterMove = playVertex(fresh, previousMoveLine, [4, 2]); // ec, correct
      expect(afterMove.lastMove).not.toBeNull();

      setPreviousMoveState(afterMove);
      expect(hasLastMoveMarkerAt([6, 2])).toBe(false);
    });
  });
});
