import { Component, OnDestroy, input, output, signal } from '@angular/core';

const RESET_CONFIRM_WINDOW_MS = 2500;
/** Below this, a second tap is almost certainly the same touch gesture as the
 *  first (double-registered tap, or an impatient reflex double-tap) rather
 *  than a deliberate, perceived confirmation — ignore it as noise. */
const RESET_CONFIRM_MIN_DWELL_MS = 350;

@Component({
  selector: 'kz-exercise-tools',
  templateUrl: './exercise-tools.component.html',
  styleUrl: './exercise-tools.component.scss',
})
export class ExerciseToolsComponent implements OnDestroy {
  readonly hintOn = input(false);
  readonly zoomedIn = input(true);
  readonly zoomDisabled = input(false);
  /** Disabled when there's no move to undo yet (fresh exercise, or mid opponent-reply). */
  readonly undoDisabled = input(false);

  readonly hintToggle = output<void>();
  readonly reset = output<void>();
  readonly zoomToggle = output<void>();
  readonly undo = output<void>();

  /**
   * Reset wipes the whole exercise in one tap, with no undo of its own — a
   * native confirm() would be a disruptive modal (out per the project's own
   * mobile-ux guidance) and out of place in a Telegram Mini App, so this is
   * an inline two-tap arm/confirm instead: first tap arms it (button becomes
   * "Confirm?" for a few seconds), second tap within that window actually
   * resets. Arming auto-expires back to the normal label if left alone.
   */
  readonly resetArmed = signal(false);
  private resetTimer?: ReturnType<typeof setTimeout>;
  private armedAt = 0;

  onResetClick(): void {
    if (this.resetArmed()) {
      if (Date.now() - this.armedAt < RESET_CONFIRM_MIN_DWELL_MS) {
        return;
      }
      this.disarmReset();
      this.reset.emit();
      return;
    }

    this.armedAt = Date.now();
    this.resetArmed.set(true);
    this.resetTimer = setTimeout(() => this.resetArmed.set(false), RESET_CONFIRM_WINDOW_MS);
  }

  ngOnDestroy(): void {
    clearTimeout(this.resetTimer);
  }

  private disarmReset(): void {
    clearTimeout(this.resetTimer);
    this.resetArmed.set(false);
  }
}
