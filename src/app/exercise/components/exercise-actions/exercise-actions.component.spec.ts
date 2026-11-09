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
      (play)="log('play')"
      (cancel)="log('cancel')"
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

  it('renders Play {coord} and Cancel for a preview', () => {
    fixture.componentInstance.actions.set({ kind: 'preview', coord: 'Q16' });
    fixture.detectChanges();

    const labels = buttons().map((b) => b.textContent?.trim());
    expect(labels).toContain('Play Q16');
    expect(buttons().some((b) => b.getAttribute('aria-label') === 'Cancel')).toBe(true);
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

  it('is sticky to the bottom of the viewport with an opaque background (Mobile-UX fix)', () => {
    fixture.detectChanges();

    const actionsEl = fixture.nativeElement.querySelector('.kz-actions') as HTMLElement;
    const style = getComputedStyle(actionsEl);

    expect(style.position).toBe('sticky');
    expect(style.bottom).toBe('0px');
    expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  });
});
