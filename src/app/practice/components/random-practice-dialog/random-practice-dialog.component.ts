import { Component, output, signal } from '@angular/core';

const DEFAULT_COUNT = 5;
const MAX_COUNT = 10;

/**
 * The "how many exercises?" popup shown when Random practice is tapped
 * (Daily Practice Home) — a plain confirm/cancel popup can't carry a slider,
 * so this is a small custom overlay instead of TelegramService.showPopup.
 * The chosen count only applies to this one generated session, independent
 * of the exerciseCount preference (which only sizes the daily session).
 */
@Component({
  selector: 'kz-random-practice-dialog',
  templateUrl: './random-practice-dialog.component.html',
  styleUrl: './random-practice-dialog.component.scss',
})
export class RandomPracticeDialogComponent {
  readonly confirmed = output<number>();
  readonly cancelled = output<void>();

  readonly open = signal(false);
  readonly count = signal(DEFAULT_COUNT);
  readonly maxCount = MAX_COUNT;

  show(): void {
    this.count.set(DEFAULT_COUNT);
    this.open.set(true);
  }

  onCountInput(value: string): void {
    this.count.set(Number(value));
  }

  cancel(): void {
    this.open.set(false);
    this.cancelled.emit();
  }

  confirm(): void {
    this.open.set(false);
    this.confirmed.emit(this.count());
  }
}
