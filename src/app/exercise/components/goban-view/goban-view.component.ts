import { Component, computed, input, output } from '@angular/core';
import type { Map as ShudanMap, Vertex } from '@sabaki/shudan';
import { GobanAdapterComponent, type VertexClass } from '../../../board/goban-adapter.component';
import type { ExerciseLine } from '../../exercise-line';
import { hintVertex, type ExerciseState } from '../../exercise-state';
import { computeZoomWindow } from '../../zoom-window';

/**
 * Exercise-specific presentation layer over GobanAdapterComponent: turns
 * ExerciseState + ExerciseLine into a signMap, vertex overlay classes and a
 * zoom window. Pure @Input-driven, no services — API/state concerns stay in
 * ExercisePage.
 */
@Component({
  selector: 'kz-goban-view',
  imports: [GobanAdapterComponent],
  template: `
    <div class="kz-board kz-board--kaya">
      <kz-goban-adapter
        [signMap]="signMap()"
        [vertexClasses]="vertexClasses()"
        [rangeX]="zoomWindow().rangeX"
        [rangeY]="zoomWindow().rangeY"
        [coordLabel]="coordLabel"
        [interactive]="interactive()"
        (vertexClick)="vertexTap.emit($event)"
      />
    </div>
  `,
  styleUrl: './goban-view.component.scss',
})
export class GobanViewComponent {
  readonly state = input.required<ExerciseState>();
  readonly line = input.required<ExerciseLine>();

  readonly vertexTap = output<Vertex>();

  readonly coordLabel = (vertex: Vertex): string => this.line().setupBoard.stringifyVertex(vertex);

  /** Only 'play' accepts taps — 'reply'/'wrong'/'done' lock the board (Mobile-UX fix: taps during those phases silently no-op otherwise, with no feedback). */
  readonly interactive = computed(() => this.state().phase === 'play');

  readonly signMap = computed<ShudanMap<0 | 1 | -1>>(() => {
    const state = this.state();
    const map = state.board.signMap.map((row) => [...row]) as (0 | 1 | -1)[][];

    if (state.phase === 'play' && state.preview) {
      const [x, y] = state.preview;
      map[y][x] = this.line().userSign;
    }

    return map;
  });

  readonly vertexClasses = computed<VertexClass[]>(() => {
    const state = this.state();
    const line = this.line();
    const classes: VertexClass[] = [];

    if (state.lastMove) {
      classes.push({ vertex: state.lastMove.vertex, className: 'kz-last-move' });
    }
    if (state.phase === 'play' && state.preview) {
      classes.push({ vertex: state.preview, className: 'kz-preview' });
    }
    if (state.phase === 'wrong' && state.wrongMove) {
      classes.push({ vertex: state.wrongMove.vertex, className: 'kz-wrong' });
    }
    if (state.illegal) {
      classes.push({ vertex: state.illegal.vertex, className: 'kz-illegal' });
    }

    const hint = hintVertex(state, line);
    if (hint) {
      classes.push({ vertex: hint, className: 'kz-hint' });
    }

    return classes;
  });

  readonly zoomWindow = computed(() => {
    const state = this.state();
    const line = this.line();

    if (!state.zoomedIn || line.boardSize <= 13) {
      return { rangeX: undefined, rangeY: undefined } as { rangeX?: [number, number]; rangeY?: [number, number] };
    }

    const pointsOfInterest: Vertex[] = [
      ...(line.mistakeVertex ? [line.mistakeVertex] : []),
      ...line.kataGoLine.map((p) => p.vertex),
    ];

    return computeZoomWindow(line.boardSize, pointsOfInterest);
  });
}
