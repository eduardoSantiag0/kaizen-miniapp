import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PracticeService } from '../../data/practice.service';

type Screen = 'loading' | 'ready' | 'error';

/**
 * The streak chip beside the "Games" title (handoff v5-1-kaizen-daily-practice
 * section 3) — self-contained, same pattern as DailyPracticeButtonComponent:
 * fetches its own streak and hides itself at 0 / while loading or failed,
 * rather than GamesPageComponent threading PracticeService down to it.
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
  /** Hidden at 0, and while loading or failed (handoff section 3). */
  readonly hidden = computed(() => this.screen() !== 'ready' || this.currentStreak() === 0);

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
      error: () => this.screen.set('error'),
    });
  }
}
