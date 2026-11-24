import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PracticeService } from '../data/practice.service';
import type { DailyPracticeSession, StreakInfo } from '../data/practice.model';
import { TelegramService } from '../core/telegram.service';
import { PaperBackgroundComponent } from '../shared/paper-background/paper-background.component';
import { SeigaihaFillComponent } from '../shared/seigaiha-fill/seigaiha-fill.component';
import { StreakStripComponent } from '../shared/streak-strip/streak-strip.component';

const EMPTY_STREAK: StreakInfo = { currentStreak: 0, last7Days: [false, false, false, false, false, false, false] };

/**
 * The completion screen (handoff v4-3-kaizen-daily-practice section 8) —
 * shown once, right after Finish practice. No stats, points or ranks: the
 * last-7-days strip and the plain streak count are the only feedback. Done
 * and the BackButton both return to Games.
 */
@Component({
  selector: 'kz-practice-complete',
  imports: [PaperBackgroundComponent, SeigaihaFillComponent, StreakStripComponent],
  templateUrl: './practice-complete.component.html',
  styleUrl: './practice-complete.component.scss',
})
export class PracticeCompleteComponent {
  private readonly practice = inject(PracticeService);
  private readonly telegram = inject(TelegramService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly session = signal<DailyPracticeSession | null>(null);
  private readonly streak = signal<StreakInfo>(EMPTY_STREAK);

  readonly totalCount = computed(() => this.session()?.exercises.length ?? 0);
  readonly currentStreak = computed(() => this.streak().currentStreak);
  readonly last7Days = computed(() => this.streak().last7Days);
  readonly isFirstDay = computed(() => this.currentStreak() <= 1);

  /** Null on the first day — the headline is then plain text with no number to pick out in Mono. */
  readonly headlineNumber = computed<number | null>(() => (this.isFirstDay() ? null : this.currentStreak()));
  readonly headlineSuffix = computed(() => (this.isFirstDay() ? 'Your streak starts today' : `day${this.currentStreak() === 1 ? '' : 's'} in a row`));
  readonly feedbackLine = computed(() => {
    const total = this.totalCount();
    return `Practice complete — all ${total} exercise${total === 1 ? '' : 's'} done. One step better than yesterday.`;
  });
  readonly nextStreakNumber = computed(() => this.currentStreak() + 1);

  constructor() {
    this.telegram.showBackButton(this.done);
    this.destroyRef.onDestroy(() => this.telegram.hideBackButton(this.done));
    this.practice.getTodaySession().subscribe((session) => this.session.set(session));
    this.practice.getStreak().subscribe((streak) => this.streak.set(streak));
  }

  readonly done = (): void => {
    this.router.navigate(['/']);
  };
}
