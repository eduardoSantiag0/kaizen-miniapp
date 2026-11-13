import { Component, ElementRef, effect, inject, input, output } from '@angular/core';
import type { ActionsCopy } from '../../exercise-copy';

@Component({
  selector: 'kz-exercise-actions',
  templateUrl: './exercise-actions.component.html',
  styleUrl: './exercise-actions.component.scss',
})
export class ExerciseActionsComponent {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  readonly actions = input.required<ActionsCopy>();
  /** Label for the 'done' phase's secondary button — "Back to games" from the menu, swappable for a future session mode. */
  readonly correctSecondaryLabel = input('Back to games');

  readonly tryAgain = output<void>();
  readonly playAgain = output<void>();
  readonly backToGames = output<void>();
  /** The 'done' phase's secondary button specifically (separate from the plain error-screen backToGames above). */
  readonly doneSecondary = output<void>();
  /** Re-fetches the game on the 'error' screen (transient load failure) — distinct from backToGames, which 'sgfError' (unreadable record) still uses since retrying a corrupt SGF can't help. */
  readonly retryLoad = output<void>();

  /**
   * Mobile-UX's thumb-reach fix, take two (the original used position: sticky,
   * which coexisted with the overlap/obstruction bugs fixed elsewhere on this
   * screen — see exercise-actions.component.scss): a one-time scroll nudge on
   * freshly entering 'wrong' ('tryAgain' actions) or 'done' ('correct'
   * actions), so these buttons come into view without pinning anything.
   * Tracked by kind rather than relying on effect() re-run frequency, since
   * exercise-copy.ts's actionsFor() returns a fresh object each time —
   * without this guard, a same-kind re-render (object identity changed, value
   * didn't) would scroll again, which is not "once per fresh completion."
   */
  private lastScrolledKind: ActionsCopy['kind'] | null = null;

  constructor() {
    effect(() => {
      const kind = this.actions().kind;
      const isFreshArrival = (kind === 'tryAgain' || kind === 'correct') && kind !== this.lastScrolledKind;
      this.lastScrolledKind = kind;
      if (isFreshArrival) this.scrollIntoView();
    });
  }

  private scrollIntoView(): void {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.host.nativeElement.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'end' });
  }
}
