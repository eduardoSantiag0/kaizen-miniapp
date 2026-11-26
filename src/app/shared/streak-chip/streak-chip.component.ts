import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PracticeService } from '../../data/practice.service';

type Screen = 'loading' | 'ready' | 'error';

/**
 * The streak chip beside the "Games" title — self-contained, same pattern as
 * DailyPracticeButtonComponent: fetches its own streak rather than
 * GamesPageComponent threading PracticeService down to it. Always visible
 * once loaded (even at a streak of 0) so it stays a reachable entry point
 * into PracticeComplete, not just a trophy that only shows up once there's
 * already something to show off.
 *
 * Links to PracticeComplete regardless of whether today's practice is
 * finished — that screen itself decides between the DailyComplete and
 * DailyStreak states (section 8) from its own fetched streak/session data.
 */
@Component({
  selector: 'kz-streak-chip',
  imports: [RouterLink],
  templateUrl: './streak-chip.component.html',
  styleUrl: './streak-chip.component.scss',
})
export class StreakChipComponent {
  private readonly practice = inject(PracticeService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly screen = signal<Screen>('loading');
  private readonly currentStreak = signal(0);

  readonly days = computed(() => this.currentStreak());
  /** Hidden only while loading or failed — a 0-day streak still shows, so the chip stays a working link into PracticeComplete. */
  readonly hidden = computed(() => this.screen() !== 'ready');

  readonly ariaLabel = computed(() => `Streak: ${this.days()} day${this.days() === 1 ? '' : 's'} in a row`);

  constructor() {
    this.load();

    // Same reasoning as DailyPracticeButtonComponent/DailyPracticeHomeComponent's own
    // listeners — Telegram can suspend this page mid-request or across days.
    const onVisible = () => {
      if (document.visibilityState === 'visible') this.load();
    };
    document.addEventListener('visibilitychange', onVisible);
    this.destroyRef.onDestroy(() => document.removeEventListener('visibilitychange', onVisible));
  }

  private load(): void {
    this.practice.getStreak().subscribe({
      next: (streak) => {
        this.currentStreak.set(streak.currentStreak);
        this.screen.set('ready');
      },
      // A visibilitychange-triggered refetch failing must not hide a chip that's
      // already showing a real streak — only the first load can show 'error'.
      error: () => {
        if (this.screen() !== 'ready') this.screen.set('error');
      },
    });
  }
}
