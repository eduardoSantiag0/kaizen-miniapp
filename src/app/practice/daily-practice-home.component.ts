import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { PracticeService } from '../data/practice.service';
import { isDeepening, readPracticePosition } from '../data/practice-local';
import { DEFAULT_PRACTICE_PREFERENCES, type DailyPracticeSession, type PracticeExerciseRef, type PracticePreferences, type PracticeSessionSummary } from '../data/practice.model';
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
  readonly dailySession = signal<DailyPracticeSession | null>(null);
  readonly generatedSessions = signal<PracticeSessionSummary[]>([]);
  private readonly nextSessionPage = signal<number | null>(null);
  private sessionListRequest = 0;
  private failedSessionPage: number | null = null;
  readonly loadingSessions = signal(false);
  readonly sessionListError = signal(false);
  readonly hasMoreSessions = computed(() => this.nextSessionPage() !== null);
  readonly preferences = signal<PracticePreferences>({ ...DEFAULT_PRACTICE_PREFERENCES });
  /** Hidden at 0 and while loading (handoff section 4) — 0 is the signal's own default until the real count arrives. */
  readonly currentStreak = signal(0);

  readonly exercises = computed(() => this.dailySession()?.exercises ?? []);
  readonly totalCount = computed(() => this.exercises().length);
  readonly completedCount = computed(() => this.exercises().filter((e) => e.completed).length);
  readonly isComplete = computed(() => this.dailySession()?.completed === true);
  readonly deepeningExercise = computed(() => {
    const session = this.dailySession();
    return session?.exercises.find((exercise) =>
      isDeepening(readPracticePosition(this.practice.storageAccountId, session.id, exercise.id)),
    );
  });
  readonly hasStarted = computed(() => this.completedCount() > 0);
  readonly isEmpty = computed(() => this.totalCount() === 0);

  readonly dateLabel = computed(() => {
    const date = this.dailySession()?.date;
    if (!date) return '';
    const day = new Date(`${date}T00:00:00Z`);
    const weekday = day.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    const month = day.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
    return `${weekday}, ${day.getUTCDate()} ${month}`;
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

  rowAriaLabel(exercise: PracticeExerciseRef): string {
    return exercise.origin === 'dataset' ? 'Open community exercise' : `Open exercise vs ${exercise.opponentName}`;
  }

  /** How many of a generated session's own exercises are done, for its row in the "Other sessions" list. */
  sessionProgressLabel(session: PracticeSessionSummary): string {
    if (session.completed) return 'Done';
    return `${session.completedCount} of ${session.exerciseCount} done`;
  }

  startOrContinue(): void {
    const session = this.dailySession();
    if (session) this.router.navigate(['/practice/session', session.id]);
  }

  resumeDeepening(): void {
    const exercise = this.deepeningExercise();
    if (exercise) this.openExercise(exercise);
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

  readonly startingRound = signal(false);
  readonly roundError = signal<string | null>(null);

  startMoreExercises(): void {
    if (this.startingRound()) return;
    this.roundError.set(null);
    this.startingRound.set(true);
    this.practice.startNewRound().pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.startingRound.set(false)),
    ).subscribe({
      next: (session) => {
        if (!session.exercises.length) {
          this.roundError.set('No exercises available for another round.');
          return;
        }
        this.router.navigate(['/practice/session', session.id], { info: { startedSession: session } });
      },
      error: (error) => {
        console.error('Failed to start a new practice round', error);
        this.roundError.set("Couldn't start another round. Try again.");
      },
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
      next: (session) => {
        this.dailySession.set(session);
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

  loadMoreSessions(): void {
    if (!this.loadingSessions()) this.refreshSessions(this.failedSessionPage ?? this.nextSessionPage() ?? 0);
  }

  private refreshSessions(page = 0): void {
    const request = ++this.sessionListRequest;
    this.loadingSessions.set(true);
    this.sessionListError.set(false);
    this.failedSessionPage = null;
    this.practice.listSessions(page, 20, 'generated').subscribe({
      next: ({ sessions, nextPage }) => {
        if (request !== this.sessionListRequest) return;
        const existing = page === 0 ? [] : this.generatedSessions();
        const ids = new Set(existing.map((session) => session.id));
        this.generatedSessions.set([...existing, ...sessions.filter((session) => !ids.has(session.id))]);
        this.nextSessionPage.set(nextPage ?? null);
        this.loadingSessions.set(false);
      },
      error: () => {
        if (request !== this.sessionListRequest) return;
        this.loadingSessions.set(false);
        this.sessionListError.set(true);
        this.failedSessionPage = page;
      },
    });
  }

  readonly backToGames = (): void => {
    this.router.navigate(['/']);
  };
}
