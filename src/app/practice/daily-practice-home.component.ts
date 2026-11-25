import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PracticeService } from '../data/practice.service';
import { DEFAULT_PRACTICE_PREFERENCES, type DailyPracticeSession, type PracticeExerciseRef, type PracticePreferences } from '../data/practice.model';
import { TelegramService } from '../core/telegram.service';
import { PaperBackgroundComponent } from '../shared/paper-background/paper-background.component';
import { SeigaihaFillComponent } from '../shared/seigaiha-fill/seigaiha-fill.component';
import { SessionTrackComponent } from '../shared/session-track/session-track.component';
import { StreakBadgeComponent } from '../shared/streak-badge/streak-badge.component';

type Screen = 'loading' | 'ready' | 'error';
export type ExerciseRowStatus = 'solved' | 'next' | 'ahead';

/**
 * Daily Practice Home (handoff v4-kaizen-daily-practice section 4) — the
 * session's entry screen: today's exercise list, a Start/Continue practice
 * button, and the Practice settings row. One component covers every listed
 * artboard (DailyHome/DailyContinue/DailyDone/DailyLoading/DailyEmpty/
 * DailyError) as states of the same screen, the same pattern GamesPage uses
 * for its own loading/error/ready/empty states.
 */
@Component({
  selector: 'kz-daily-practice-home',
  imports: [PaperBackgroundComponent, SeigaihaFillComponent, SessionTrackComponent, StreakBadgeComponent],
  templateUrl: './daily-practice-home.component.html',
  styleUrl: './daily-practice-home.component.scss',
})
export class DailyPracticeHomeComponent {
  private readonly practice = inject(PracticeService);
  private readonly telegram = inject(TelegramService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly screen = signal<Screen>('loading');
  private readonly session = signal<DailyPracticeSession | null>(null);
  readonly preferences = signal<PracticePreferences>({ ...DEFAULT_PRACTICE_PREFERENCES });
  /** Hidden at 0 and while loading (handoff section 4) — 0 is the signal's own default until the real count arrives. */
  readonly currentStreak = signal(0);

  readonly exercises = computed(() => this.session()?.exercises ?? []);
  readonly totalCount = computed(() => this.exercises().length);
  readonly completedCount = computed(() => this.exercises().filter((e) => e.completed).length);
  readonly isComplete = computed(() => this.session()?.completed === true);
  readonly hasStarted = computed(() => this.completedCount() > 0);
  readonly isEmpty = computed(() => this.totalCount() === 0);

  readonly dateLabel = computed(() => {
    const now = new Date();
    const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
    const month = now.toLocaleDateString('en-US', { month: 'long' });
    return `${weekday}, ${now.getDate()} ${month}`;
  });

  /** SessionTrack's trailing label — "3 exercises" / "1 of 3 done" / "3 of 3 done" (section 4). */
  readonly trackLabel = computed(() => {
    const total = this.totalCount();
    const completed = this.completedCount();
    if (completed === 0) return `${total} exercise${total === 1 ? '' : 's'}`;
    return `${completed} of ${total} done`;
  });

  readonly trackCurrent = computed(() => (this.isComplete() ? this.totalCount() + 1 : this.completedCount() + 1));

  readonly primaryLabel = computed(() => (this.hasStarted() ? 'Continue practice' : 'Start practice'));
  readonly primaryNote = computed(() => {
    if (this.hasStarted()) {
      const next = this.completedCount() + 1;
      return `Exercise ${next} of ${this.totalCount()} · picks up where you left`;
    }
    return `${this.totalCount()} exercise${this.totalCount() === 1 ? '' : 's'} today · your progress is saved as you go`;
  });

  readonly settingsSummary = computed(() => {
    const prefs = this.preferences();
    return `Top ${prefs.topVariants} moves accepted · ${prefs.continuationDepth} moves deep`;
  });

  constructor() {
    this.telegram.showBackButton(this.backToGames);
    this.destroyRef.onDestroy(() => this.telegram.hideBackButton(this.backToGames));
    this.load();
  }

  retry(): void {
    this.load();
  }

  rowStatus(exercise: PracticeExerciseRef): ExerciseRowStatus {
    if (exercise.completed) return 'solved';
    const firstUnsolved = this.exercises().find((e) => !e.completed);
    return firstUnsolved?.id === exercise.id ? 'next' : 'ahead';
  }

  rowMetaText(exercise: PracticeExerciseRef): string {
    const toPlay = exercise.userSign === 1 ? 'Black' : 'White';
    return `${toPlay} to play · ${exercise.boardSize}×${exercise.boardSize} · move ${exercise.moveNumber}`;
  }

  startOrContinue(): void {
    this.router.navigate(['/practice/session']);
  }

  reviewExercises(): void {
    this.router.navigate(['/practice/session'], { queryParams: { review: '1' } });
  }

  /** "Continue practicing" (shown once today's original session is complete): generates another set of problems and jumps straight into solving them, rather than just refreshing this screen's own list. */
  continuePracticing(): void {
    this.practice.startNewRound().subscribe((session) => {
      this.session.set(session);
      this.router.navigate(['/practice/session']);
    });
  }

  /** "Random practice" (below Start/Continue practice): a session built entirely from the bundled practice-pool, for testing — see PracticeService.startRandomPractice's own doc comment. */
  startRandomPractice(): void {
    this.practice.startRandomPractice().subscribe((session) => {
      this.session.set(session);
      this.router.navigate(['/practice/session']);
    });
  }

  openSettings(): void {
    this.router.navigate(['/practice/settings']);
  }

  private load(): void {
    this.screen.set('loading');

    this.practice.startTodaySession().subscribe({
      next: (session) => {
        this.session.set(session);
        this.screen.set('ready');
        this.practice.getPreferences().subscribe((prefs) => this.preferences.set(prefs));
        this.practice.getStreak().subscribe((streak) => this.currentStreak.set(streak.currentStreak));
      },
      error: () => this.screen.set('error'),
    });
  }

  readonly backToGames = (): void => {
    this.router.navigate(['/']);
  };
}
