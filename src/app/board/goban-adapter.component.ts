import { Component, ElementRef, OnDestroy, effect, inject, input, output } from '@angular/core';
import { h, render } from 'preact';
import { BoundedGoban } from '@sabaki/shudan';
import type { Map as ShudanMap, Vertex } from '@sabaki/shudan';

export interface VertexClass {
  vertex: Vertex;
  className: string;
}

/**
 * Isolated Angular/Preact boundary: Shudan is a Preact component tree, so it
 * is mounted into this component's own host element with Preact's `render`,
 * and explicitly unmounted (`render(null, host)`) on destroy. Nothing else
 * in the app touches Preact directly.
 *
 * Last-move/illegal/wrong/hint looks are applied as plain CSS classes
 * on the rendered `.shudan-vertex` elements (see `vertexClasses`) rather than
 * through Shudan's ghostStoneMap/markerMap, so they can match HANDOFF.md's
 * exact visuals through our own stylesheet hooks (goban-theme.scss).
 */
@Component({
  selector: 'kz-goban-adapter',
  template: '',
})
export class GobanAdapterComponent implements OnDestroy {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  readonly signMap = input.required<ShudanMap<0 | 1 | -1>>();
  readonly vertexClasses = input<VertexClass[]>([]);
  readonly rangeX = input<[number, number] | undefined>(undefined);
  readonly rangeY = input<[number, number] | undefined>(undefined);
  readonly showCoordinates = input(true);
  readonly maxWidth = input(390);
  /** Matches zoom-window.ts's HEIGHT_BUDGET (the same canonical canvas measurement) so BoundedGoban's own sizing doesn't fight the zoom window's row count. */
  readonly maxHeight = input(476);
  readonly coordLabel = input<(vertex: Vertex) => string>(() => '');
  /** False while the board shouldn't accept taps (opponent replying, a wrong move showing, line done) — see goban-theme.scss's --locked rule. */
  readonly interactive = input(true);

  readonly vertexClick = output<Vertex>();

  /**
   * The vertexClasses this component itself applied on the previous render —
   * tracked explicitly because Preact only touches a vertex's className when
   * Shudan's own computed value for it changes (sign, marker, etc.). Whenever
   * two consecutive renders give Shudan the exact same sign/marker for a
   * vertex but our own overlay classes changed (e.g. a wrong-move ring that
   * should clear on the next render), Preact's diff never revisits that
   * element's class attribute, so a stale class would otherwise survive past
   * the render where it stopped applying.
   */
  private previousClasses: VertexClass[] = [];

  constructor() {
    effect(() => {
      render(
        h(BoundedGoban, {
          signMap: this.signMap(),
          rangeX: this.rangeX(),
          rangeY: this.rangeY(),
          showCoordinates: this.showCoordinates(),
          maxWidth: this.maxWidth(),
          maxHeight: this.maxHeight(),
          fuzzyStonePlacement: false,
          animateStonePlacement: true,
          onVertexClick: (_evt, vertex) => this.vertexClick.emit(vertex),
        }),
        this.host.nativeElement
      );

      this.host.nativeElement.classList.toggle('kz-goban-adapter--locked', !this.interactive());
      this.decorateVertices();
    });
  }

  ngOnDestroy(): void {
    render(null, this.host.nativeElement);
  }

  private decorateVertices(): void {
    const classes = this.vertexClasses();
    const label = this.coordLabel();
    const interactive = this.interactive();
    const elements = this.host.nativeElement.querySelectorAll<HTMLElement>('.shudan-vertex');

    for (const el of Array.from(elements)) {
      const x = Number(el.dataset['x']);
      const y = Number(el.dataset['y']);
      const occupied = el.classList.contains('shudan-sign_1') || el.classList.contains('shudan-sign_-1');

      if (!interactive) {
        el.removeAttribute('role');
        el.removeAttribute('aria-label');
        el.removeAttribute('tabindex');
        el.setAttribute('aria-disabled', 'true');
      } else if (occupied) {
        el.removeAttribute('role');
        el.removeAttribute('aria-label');
        el.removeAttribute('tabindex');
        el.removeAttribute('aria-disabled');
      } else {
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', `Play ${label([x, y])}`);
        el.setAttribute('tabindex', '0');
        el.removeAttribute('aria-disabled');
      }

      for (const stale of this.previousClasses) {
        if (stale.vertex[0] === x && stale.vertex[1] === y) {
          el.classList.remove(stale.className);
        }
      }
      for (const extra of classes) {
        if (extra.vertex[0] === x && extra.vertex[1] === y) {
          el.classList.add(extra.className);
        }
      }
    }

    this.previousClasses = classes;
  }
}
