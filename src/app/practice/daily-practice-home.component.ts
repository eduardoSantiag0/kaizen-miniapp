import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { PracticeService } from '../data/practice.service';
import { DEFAULT_PRACTICE_PREFERENCES, type DailyPracticeSession, type PracticeExerciseRef, type PracticePreferences } from '../data/practice.model';
import { TelegramService } from '../core/telegram.service';
import { PaperBackgroundComponent } from '../shared/paper-background/paper-background.component';
import { SeigaihaFillComponent } from '../shared/seigaiha-fill/seigaiha-fill.component';
import { SessionTrackComponent } from '../shared/session-track/session-track.component';
import { StreakBadgeComponent } from '../shared/streak-badge/streak-badge.component';
import { RandomPracticeDialogComponent } from './components/random-practice-dialog/random-practice-dialog.component';

type Screen = 'loading' | 'ready' | 'error';
export type ExerciseRowStatus = 'solved' | 'next' | 'ahead';

/**
 * Daily Practice Home (handoff v4-kaizen-daily-practice section 4) — the
 * session's entry screen: today's exercise list, a Start/Continue practice
 * button, the Practice settings row, and any other sessions the chat has
 * generated ("Random practice"), each opening its own set of exercises
 * (never the daily one's) and never affecting the streak. One component
 * covers every listed artboard (DailyHome/DailyContinue/DailyDone/
 * DailyLoading/DailyEmpty/DailyError) as states of the same screen, the
 * same pattern GamesPage uses for its own loading/error/ready/empty states.
 */
@Component({
  selector: 'kz-daily-practice-home',
  imports: [PaperBackgroundComponent, SeigaihaFillComponent, SessionTrackComponent, StreakBadgeComponent, RandomPracticeDialogComponent],
  templateUrl: './daily-practice-home.component.html',
  styleUrl: './daily-practice-home.component.scss',
})
export class DailyPracticeHomeComponent {
  private readonly practice = inject(PracticeService);
  private readonly telegram = inject(TelegramService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly randomPracticeDialog = viewChild.required(RandomPracticeDialogComponent);

  readonly screen = signal<Screen>('loading');
  private readonly sessions = signal<DailyPracticeSession[]>([]);
  readonly preferences = signal<PracticePreferences>({ ...DEFAULT_PRACTICE_PREFERENCES });
  /** Hidden at 0 and while loading (handoff section 4) — 0 is the signal's own default until the real count arrives. */
  readonly currentStreak = signal(0);

  /** The one always-present auto-generated session for today — null only while still loading. */
  readonly dailySession = computed(() => this.sessions().find((s) => s.kind === 'daily') ?? null);
  /** Any "Random practice" rounds the chat has generated — any number of them, listed separately from the daily session, never affecting the streak. */
  readonly generatedSessions = computed(() => this.sessions().filter((s) => s.kind === 'generated'));

  readonly exercises = computed(() => this.dailySession()?.exercises ?? []);
  readonly totalCount = computed(() => this.exercises().length);
  readonly completedCount = computed(() => this.exercises().filter((e) => e.completed).length);
  readonly isComplete = computed(() => this.dailySession()?.completed === true);
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

    // Telegram's WebView can suspend this page's JS (e.g. the chat switches away
    // mid-session) and resume it later without Angular ever destroying/recreating
    // this component — any in-flight request from that first load() may have been
    // dropped too, leaving the screen stuck on 'loading'. Either way, refreshing on
    // resume is what makes a just-solved exercise (or the row itself) show up
    // correctly instead of a stale/stuck view once the chat comes back.
    const onVisible = () => {
      if (document.visibilityState === 'visible') this.refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    this.destroyRef.onDestroy(() => document.removeEventListener('visibilitychange', onVisible));
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

  /** How many of a generated session's own exercises are done, for its row in the "Other sessions" list. */
  sessionProgressLabel(session: DailyPracticeSession): string {
    if (session.completed) return 'Done';
    const done = session.exercises.filter((e) => e.completed).length;
    return `${done} of ${session.exercises.length} done`;
  }

  startOrContinue(): void {
    const session = this.dailySession();
    if (session) this.router.navigate(['/practice/session', session.id]);
  }

  reviewExercises(): void {
    const session = this.dailySession();
    if (session) this.router.navigate(['/practice/session', session.id], { queryParams: { review: '1' } });
  }

  openSession(sessionId: string): void {
    this.router.navigate(['/practice/session', sessionId]);
  }

  /** Tapping an exercise row opens that one directly — no need to go through Start/Continue practice's "first unsolved" default. */
  openExercise(exercise: PracticeExerciseRef): void {
    const session = this.dailySession();
    if (session) this.router.navigate(['/practice/session', session.id], { queryParams: { exerciseId: exercise.id } });
  }

  /** "Continue practicing" (shown once today's original session is complete): generates another set of problems and jumps straight into solving them, replacing the daily session in place — never adding a second one. */
  continuePracticing(): void {
    // No retry here (unlike recordResult/setPreferences): this creates a new round
    // server-side, so retrying a request that actually succeeded but lost its response
    // would create a second one instead of just missing a write.
    this.practice.startNewRound().subscribe({
      next: (session) => {
        this.refreshSessions();
        this.router.navigate(['/practice/session', session.id]);
      },
      error: (err) => console.error('Failed to start a new practice round', err),
    });
  }

  /** "Random practice" (below Start/Continue practice): opens the exercise-count dialog first — see PracticeService.startRandomPractice's own doc comment. */
  openRandomPracticeDialog(): void {
    this.randomPracticeDialog().show();
  }

  onRandomPracticeConfirmed(count: number): void {
    this.practice.startRandomPractice(count).subscribe({
      next: (session) => {
        this.refreshSessions();
        this.router.navigate(['/practice/session', session.id]);
      },
      error: (err) => console.error('Failed to start random practice', err),
    });
  }

  openSettings(): void {
    this.router.navigate(['/practice/settings']);
  }

  private load(): void {
    this.screen.set('loading');
    this.fetch();
  }

  /** Re-fetches without first blanking the screen to 'loading' — used on visibilitychange, where the screen already has today's data and a Telegram-suspend-triggered refetch should never read as a fresh reload. */
  private refresh(): void {
    this.fetch();
  }

  private fetch(): void {
    this.practice.startTodaySession().subscribe({
      next: () => {
        this.refreshSessions();
        this.screen.set('ready');
        this.practice.getPreferences().subscribe({
          next: (prefs) => this.preferences.set(prefs),
          error: (err) => console.error('Failed to load practice preferences', err),
        });
        this.practice.getStreak().subscribe({
          next: (streak) => this.currentStreak.set(streak.currentStreak),
          error: (err) => console.error('Failed to load streak', err),
        });
      },
      // A background refresh failing must not blank out data already on screen —
      // only show the error state if we had nothing to show in the first place.
      error: () => {
        if (this.screen() !== 'ready') this.screen.set('error');
      },
    });
  }

  private refreshSessions(): void {
    this.practice.listSessions().subscribe((sessions) => this.sessions.set(sessions));
  }

  readonly backToGames = (): void => {
    this.router.navigate(['/']);
  };
}
