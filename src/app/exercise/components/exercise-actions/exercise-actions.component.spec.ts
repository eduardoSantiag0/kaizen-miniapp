import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { ActionsCopy } from '../../exercise-copy';
import { ExerciseActionsComponent } from './exercise-actions.component';

@Component({
  selector: 'kz-test-host',
  imports: [ExerciseActionsComponent],
  template: `
    <kz-exercise-actions
      [actions]="actions()"
      [correctSecondaryLabel]="correctSecondaryLabel()"
      (tryAgain)="log('tryAgain')"
      (playAgain)="log('playAgain')"
      (backToGames)="log('backToGames')"
      (doneSecondary)="log('doneSecondary')"
    />
  `,
})
class TestHostComponent {
  readonly actions = signal<ActionsCopy>({ kind: 'none' });
  readonly correctSecondaryLabel = signal('Back to games');
  readonly events: string[] = [];
  log(event: string): void {
    this.events.push(event);
  }
}

describe('ExerciseActionsComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TestHostComponent);
  });

  function buttons(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('button'));
  }

  it('renders no buttons for {kind: "none"}', () => {
    fixture.detectChanges();
    expect(buttons().length).toBe(0);
  });

  it('renders Try again for {kind: "tryAgain"} and emits on click', () => {
    fixture.componentInstance.actions.set({ kind: 'tryAgain' });
    fixture.detectChanges();

    buttons()[0].click();
    expect(fixture.componentInstance.events).toEqual(['tryAgain']);
  });

  it('uses correctSecondaryLabel for the done phase\'s secondary button, separate from backToGames', () => {
    fixture.componentInstance.actions.set({ kind: 'correct' });
    fixture.componentInstance.correctSecondaryLabel.set('Next exercise');
    fixture.detectChanges();

    const labels = buttons().map((b) => b.textContent?.trim());
    expect(labels).toContain('Play again');
    expect(labels).toContain('Next exercise');

    buttons().find((b) => b.textContent?.trim() === 'Next exercise')!.click();
    expect(fixture.componentInstance.events).toEqual(['doneSecondary']);
  });

  it('stacks the two completion buttons full-width vertically instead of side-by-side (deliberate change)', () => {
    fixture.componentInstance.actions.set({ kind: 'correct' });
    fixture.detectChanges();

    const actionsEl = fixture.nativeElement.querySelector('.kz-actions') as HTMLElement;
    expect(actionsEl.classList.contains('kz-actions--stacked')).toBe(true);
    expect(getComputedStyle(actionsEl).flexDirection).toBe('column');

    // Primary (Back to games) leads, secondary (Play again) follows — matches
    // the stated hierarchy: 3. primary action, 4. secondary action.
    const [backToGames, playAgain] = buttons();
    expect(backToGames.classList.contains('kz-btn--primary')).toBe(true);
    expect(playAgain.classList.contains('kz-btn--outline')).toBe(true);
    expect(backToGames.classList.contains('kz-btn--full')).toBe(true);
    expect(playAgain.classList.contains('kz-btn--full')).toBe(true);
  });

  it('uses a shorter 44px height and 16px font for the stacked completion buttons only (user feedback: too tall/dominant)', () => {
    fixture.componentInstance.actions.set({ kind: 'correct' });
    fixture.detectChanges();

    for (const button of buttons()) {
      const style = getComputedStyle(button);
      expect(style.height).toBe('44px');
      expect(style.fontSize).toBe('16px');
    }
  });

  it('does not shrink the single Try again button (scoped to the stacked/correct case only)', () => {
    fixture.componentInstance.actions.set({ kind: 'tryAgain' });
    fixture.detectChanges();

    const style = getComputedStyle(buttons()[0]);
    expect(style.height).toBe('52px');
    expect(style.fontSize).toBe('17px');
  });

  it('gives the stacked completion row more top margin than the usual 16px (breathing room after the celebration badge/glow)', () => {
    fixture.componentInstance.actions.set({ kind: 'correct' });
    fixture.detectChanges();

    const actionsEl = fixture.nativeElement.querySelector('.kz-actions') as HTMLElement;
    expect(getComputedStyle(actionsEl).marginTop).toBe('24px');
  });

  it('does not stack for other action kinds', () => {
    fixture.componentInstance.actions.set({ kind: 'tryAgain' });
    fixture.detectChanges();

    const actionsEl = fixture.nativeElement.querySelector('.kz-actions') as HTMLElement;
    expect(actionsEl.classList.contains('kz-actions--stacked')).toBe(false);
  });

  it('renders a disabled Loading… button for {kind: "loading"}', () => {
    fixture.componentInstance.actions.set({ kind: 'loading' });
    fixture.detectChanges();

    const button = buttons()[0];
    expect(button.textContent?.trim()).toBe('Loading…');
    expect(button.disabled).toBe(true);
  });

  it('renders Back to games for {kind: "backToGames"} and emits backToGames (not doneSecondary)', () => {
    fixture.componentInstance.actions.set({ kind: 'backToGames' });
    fixture.detectChanges();

    buttons()[0].click();
    expect(fixture.componentInstance.events).toEqual(['backToGames']);
  });

  it('sits in normal flow, not pinned — reachable by scrolling, not sticky positioning', () => {
    fixture.detectChanges();

    const actionsEl = fixture.nativeElement.querySelector('.kz-actions') as HTMLElement;
    const style = getComputedStyle(actionsEl);

    // A prior sticky treatment coexisted with real bugs (button covering the
    // completion message, button hidden by the WebView's own chrome); fixed
    // by sizing the page correctly against the dynamic viewport/safe areas
    // instead (see exercise-page.component.scss, seigaiha-fill.component.scss)
    // and letting the page scroll normally.
    expect(style.position).not.toBe('sticky');
  });

  describe('thumb-reach scroll nudge (Mobile-UX finding, take two without sticky)', () => {
    let scrollIntoViewSpy: jasmine.Spy;

    beforeEach(() => {
      scrollIntoViewSpy = jasmine.createSpy('scrollIntoView');
      HTMLElement.prototype.scrollIntoView = scrollIntoViewSpy;
    });

    function hostEl(): HTMLElement {
      return fixture.nativeElement.querySelector('kz-exercise-actions') as HTMLElement;
    }

    it('does not scroll for {kind: "none"}', () => {
      fixture.detectChanges();
      expect(scrollIntoViewSpy).not.toHaveBeenCalled();
    });

    it('scrolls itself into view once on freshly entering the wrong state', () => {
      fixture.detectChanges(); // kind: 'none'
      fixture.componentInstance.actions.set({ kind: 'tryAgain' });
      fixture.detectChanges();

      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
      expect(scrollIntoViewSpy.calls.mostRecent().object).toBe(hostEl());
      expect(scrollIntoViewSpy).toHaveBeenCalledWith(jasmine.objectContaining({ block: 'end' }));
    });

    it('scrolls itself into view once on freshly entering the done state', () => {
      fixture.detectChanges();
      fixture.componentInstance.actions.set({ kind: 'correct' });
      fixture.detectChanges();

      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
    });

    it('does not re-scroll on a same-kind re-render (new object, same kind)', () => {
      fixture.detectChanges();
      fixture.componentInstance.actions.set({ kind: 'tryAgain' });
      fixture.detectChanges();
      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);

      // A fresh object with the identical kind — exercise-copy.ts's actionsFor()
      // does exactly this on every re-render while still 'wrong' — must not
      // scroll again.
      fixture.componentInstance.actions.set({ kind: 'tryAgain' });
      fixture.detectChanges();
      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
    });

    it('scrolls again on leaving and freshly re-entering the wrong/done state', () => {
      fixture.detectChanges();
      fixture.componentInstance.actions.set({ kind: 'tryAgain' });
      fixture.detectChanges();
      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);

      fixture.componentInstance.actions.set({ kind: 'none' }); // e.g. "Try again" tapped, back to 'play'
      fixture.detectChanges();
      fixture.componentInstance.actions.set({ kind: 'tryAgain' }); // wrong again
      fixture.detectChanges();

      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(2);
    });

    it('uses smooth scrolling normally, and falls back to auto under prefers-reduced-motion', () => {
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = ((query: string) => ({ matches: query.includes('reduce') }) as MediaQueryList) as typeof window.matchMedia;

      fixture.detectChanges();
      fixture.componentInstance.actions.set({ kind: 'correct' });
      fixture.detectChanges();

      expect(scrollIntoViewSpy).toHaveBeenCalledWith(jasmine.objectContaining({ behavior: 'auto' }));

      window.matchMedia = originalMatchMedia;
    });
  });
});
