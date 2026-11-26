import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { PracticeService } from '../data/practice.service';
import type { DailyPracticeSession, StreakInfo } from '../data/practice.model';
import { TelegramService } from '../core/telegram.service';
import { PaperBackgroundComponent } from '../shared/paper-background/paper-background.component';
import { SeigaihaFillComponent } from '../shared/seigaiha-fill/seigaiha-fill.component';
import { StreakStripComponent } from '../shared/streak-strip/streak-strip.component';

const EMPTY_STREAK: StreakInfo = { currentStreak: 0, last7Days: [false, false, false, false, false, false, false] };

type Screen = 'loading' | 'ready' | 'error';

/**
 * The completion/streak screen (handoff v5-1-kaizen-daily-practice section
 * 8) — two states sharing one screen rather than two components (section
 * 11: "PracticeComplete takes today: 'done' | 'open'"), decided here from
 * the fetched session itself rather than a route/query input, since it's
 * reached two ways: right after Finish practice (today is always done by
 * then) and from the Games streak chip (today may not be finished yet).
 * No stats, points or ranks: the last-7-days strip and the plain streak
 * count are the only feedback. The BackButton always returns to Games.
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

  /** Today's own daily session, not yet finished — the DailyStreak state (handoff section 8), reached from the Games streak chip before Finish practice. */
  readonly todayDone = computed(() => this.session()?.completed === true);
  /** Only ever true in the 'done' state — DailyStreak never uses "Your streak starts today" (section 8's table), even at a streak of 1. */
  readonly isFirstDay = computed(() => this.todayDone() && this.currentStreak() <= 1);

  /** Null on the first day — the headline is then plain text with no number to pick out in Mono. */
  readonly headlineNumber = computed<number | null>(() => (this.isFirstDay() ? null : this.currentStreak()));
  readonly headlineSuffix = computed(() => (this.isFirstDay() ? 'Your streak starts today' : `day${this.currentStreak() === 1 ? '' : 's'} in a row`));

  readonly feedbackLine = computed(() => {
    if (!this.todayDone()) return "Today's practice isn't finished yet.";
    const total = this.totalCount();
    return `Practice complete — all ${total} exercise${total === 1 ? '' : 's'} done. One step better than yesterday.`;
  });

  readonly nextStreakNumber = computed(() => this.currentStreak() + 1);
  readonly nextStepPrefix = computed(() => (this.todayDone() ? 'Come back tomorrow to make it' : "Finish today's practice to make it"));

  /** Whether any exercise in today's own session is already solved — same test Daily Practice Home's own primary button uses to pick Start vs Continue. */
  private readonly hasStarted = computed(() => (this.session()?.exercises ?? []).some((e) => e.completed));
  readonly primaryLabel = computed(() => (this.hasStarted() ? 'Continue practice' : 'Start practice'));

  readonly screen = signal<Screen>('loading');

  constructor() {
    this.telegram.showBackButton(this.backToGames);
    this.destroyRef.onDestroy(() => this.telegram.hideBackButton(this.backToGames));
    this.load();
  }

  /** The 'error' state's own retry — this is the streak screen, the one place a silent
   * failure would read as "your streak really is zero" instead of "the fetch failed". */
  retry(): void {
    this.load();
  }

  private load(): void {
    this.screen.set('loading');
    // startTodaySession (idempotent) rather than getTodaySession — reached from the
    // streak chip, the chat may not have opened Daily Practice at all today yet.
    // forkJoin: only show real content once BOTH calls land — showing the real streak
    // next to a still-empty session (or vice versa) would misrepresent today's state.
    forkJoin({
      session: this.practice.startTodaySession(),
      streak: this.practice.getStreak(),
    }).subscribe({
      next: ({ session, streak }) => {
        this.session.set(session);
        this.streak.set(streak);
        this.screen.set('ready');
      },
      error: () => this.screen.set('error'),
    });
  }

  /** DailyComplete's Done — today is already finished, nothing left to do here but leave. */
  readonly done = (): void => {
    this.backToGames();
  };

  /** DailyStreak's Start/Continue practice — opens today's own session, same destination as Daily Practice Home's primary button. */
  startOrContinuePractice(): void {
    const session = this.session();
    if (session) this.router.navigate(['/practice/session', session.id]);
  }

  private readonly backToGames = (): void => {
    this.router.navigate(['/']);
  };
}
