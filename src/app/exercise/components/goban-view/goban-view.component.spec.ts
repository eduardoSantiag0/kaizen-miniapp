import { ComponentFixture, TestBed } from '@angular/core/testing';
import { parse } from '@sabaki/sgf';
import type { Vertex } from '@sabaki/shudan';
import { GobanViewComponent } from './goban-view.component';
import { buildExerciseTree, type ExerciseTree } from '../../exercise-tree';
import {
  initExerciseState,
  playOpponentReply,
  playVertex,
  resetExercise,
  toggleHint,
  undo,
  type ExerciseState,
} from '../../exercise-state';

function treeFromSgf(sgf: string): ExerciseTree {
  return buildExerciseTree(parse(sgf)[0]);
}

describe('GobanViewComponent', () => {
  let fixture: ComponentFixture<GobanViewComponent>;

  // Setup: AB[cc]AW[gg], user (Black) to move. Two candidate variants: ec/fc/ed/fd and gc.
  // AW[hi][ih] additionally surrounds the corner ii ([8,8]) on both its liberties, so B[ii] is suicide.
  const tree = treeFromSgf(
    '(;FF[4]SZ[9]AB[cc]AW[gg][hi][ih]PL[B](;B[ec];W[fc];B[ed];W[fd])(;B[gc]))'
  );

  function setState(state: ExerciseState): void {
    fixture = TestBed.createComponent(GobanViewComponent);
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('line', tree);
    fixture.detectChanges();
  }

  function hintVertices(): Vertex[] {
    return fixture.componentInstance
      .vertexClasses()
      .filter((c) => c.className === 'kz-hint')
      .map((c) => c.vertex);
  }

  it('before any variant is picked, rings every variant\'s first move as a hint once hint is on', () => {
    let state = initExerciseState(tree);
    state = toggleHint(state);

    setState(state);
    expect(hintVertices()).toEqual([
      [4, 2], // ec
      [6, 2], // gc
    ]);
  });

  it('shows no hint rings while hint is off', () => {
    setState(initExerciseState(tree));
    expect(hintVertices()).toEqual([]);
  });

  it('once a variant is picked, rings only the next expected move', () => {
    let state = initExerciseState(tree);
    state = toggleHint(state);
    state = playVertex(state, tree, [4, 2]); // ec, variant 0 -> reply
    state = playOpponentReply(state, tree); // -> play, step 2
    // Playing ec correctly turned hint back off — re-enable it for step 2,
    // same as the player tapping Hint again for the next move.
    state = toggleHint(state);

    setState(state);
    expect(hintVertices()).toEqual([[4, 3]]); // ed
  });

  it('adds no kz-last-move marker on a fresh exercise when the tree has no previousMove (no regression for today\'s real fixtures)', () => {
    setState(initExerciseState(tree));
    expect(tree.previousMove).toBeNull();
    expect(fixture.componentInstance.vertexClasses().some((c) => c.className === 'kz-last-move')).toBe(false);
  });

  describe('previous-move marker (reuses kz-last-move, no new style)', () => {
    // root -> single-child (;W[gc]) -> branch point. W[gc] is the real game's own
    // last move leading into this position, before any variant starts.
    const previousMoveTree = treeFromSgf(
      '(;FF[4]SZ[9]AB[cc]PL[B];W[gc](;B[ec];W[fc];B[ed];W[fd])(;B[fc])(;B[hc]))'
    );

    function setPreviousMoveState(state: ExerciseState): void {
      fixture = TestBed.createComponent(GobanViewComponent);
      fixture.componentRef.setInput('state', state);
      fixture.componentRef.setInput('line', previousMoveTree);
      fixture.detectChanges();
    }

    function hasLastMoveMarkerAt(vertex: Vertex): boolean {
      return fixture.componentInstance
        .vertexClasses()
        .some((c) => c.className === 'kz-last-move' && c.vertex[0] === vertex[0] && c.vertex[1] === vertex[1]);
    }

    it('marks the real last move before the branch point on a fresh exercise', () => {
      expect(previousMoveTree.previousMove).toEqual({ sign: -1, vertex: [6, 2] }); // gc, White

      setPreviousMoveState(initExerciseState(previousMoveTree));
      expect(hasLastMoveMarkerAt([6, 2])).toBe(true);
    });

    it('disappears once the user plays', () => {
      const fresh = initExerciseState(previousMoveTree);
      const afterMove = playVertex(fresh, previousMoveTree, [4, 2]); // ec, correct, picks variant 0
      expect(afterMove.lastMove).not.toBeNull();

      setPreviousMoveState(afterMove);
      expect(hasLastMoveMarkerAt([6, 2])).toBe(false);
    });

    it('reappears after Reset', () => {
      const fresh = initExerciseState(previousMoveTree);
      const afterMove = playVertex(fresh, previousMoveTree, [4, 2]);
      setPreviousMoveState(afterMove);
      expect(hasLastMoveMarkerAt([6, 2])).toBe(false);

      setPreviousMoveState(resetExercise(previousMoveTree));
      expect(hasLastMoveMarkerAt([6, 2])).toBe(true);
    });

    it('reappears after Undo-ing back to no variant selected', () => {
      let state = initExerciseState(previousMoveTree);
      state = playVertex(state, previousMoveTree, [4, 2]); // ec, correct -> 'reply'
      state = playOpponentReply(state, previousMoveTree); // fc, opponent's reply -> back to 'play', step 2

      setPreviousMoveState(state);
      expect(hasLastMoveMarkerAt([6, 2])).toBe(false); // a variant is already selected

      // Undo once: back to step 1, variant still selected (marker still hidden).
      state = undo(state, previousMoveTree);
      expect(state.step).toBe(1);
      expect(state.selectedVariant).toBe(0);
      setPreviousMoveState(state);
      expect(hasLastMoveMarkerAt([6, 2])).toBe(false);

      // Undo again from step 1: clears the selection entirely.
      state = undo(state, previousMoveTree);
      expect(state.selectedVariant).toBeNull();
      setPreviousMoveState(state);
      expect(hasLastMoveMarkerAt([6, 2])).toBe(true);
    });
  });
});
