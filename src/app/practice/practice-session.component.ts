import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, finalize, of, retry, throwError, timeout, TimeoutError, timer } from 'rxjs';
import { PracticeService } from '../data/practice.service';
import { isDeepening, readPracticeLocal, readPracticePosition, writePracticeLocal } from '../data/practice-local';
import type { DailyPracticeSession, PracticeExerciseRef } from '../data/practice.model';
import { ExercisePageComponent } from '../exercise/exercise-page.component';
import type { ExerciseProgress } from '../exercise/exercise-state';
import { PaperBackgroundComponent } from '../shared/paper-background/paper-background.component';

type Screen = 'loading' | 'ready' | 'error';

type CompletionStatus = 'not_completed' | 'pending_sync' | 'confirmed';
const FINISH_PRACTICE_DELAY_MS = 450;

/**
 * The thin Daily Practice session wrapper (handoff v4-kaizen-daily-practice
 * section 6/11): walks the session's exercises by rebinding
 * ExercisePageComponent's gameId/phase per
 * exercise, exactly the reusability hooks that component's own inputs/
 * outputs were built for — it owns session-position arithmetic and
 * PracticeService recording, nothing about the board/engine itself.
 *
 * `id` (bound from the route, withComponentInputBinding — same pattern
 * ExercisePageComponent's own `gameId` uses) says which session to open:
 * the one always-present daily session, or one the chat generated via
 * "Random practice" — Daily Practice Home's session list picks which.
 */
@Component({
  selector: 'kz-practice-session',
  imports: [ExercisePageComponent, PaperBackgroundComponent],
  templateUrl: './practice-session.component.html',
  styleUrl: './practice-session.component.scss',
})
export class PracticeSessionComponent {
  private readonly practice = inject(PracticeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private startedSession = (this.router.currentNavigation()?.extras.info as
    { startedSession?: DailyPracticeSession } | undefined)?.startedSession;

  readonly id = input.required<string>();

  readonly screen = signal<Screen>('loading');
  private readonly session = signal<DailyPracticeSession | null>(null);
  private readonly currentExerciseId = signal<string | null>(null);
  private readonly destroyRef = inject(DestroyRef);
  private finishSub?: Subscription;
  private loadSub?: Subscription;
  private readonly pendingResults = signal(new Set<string>());
  private readonly rejectedResults = signal(new Set<string>());
  private readonly syncingResults = signal(new Set<string>());
  private readonly positions = signal(new Map<string, ExerciseProgress>());
  readonly finishedLocally = signal(false);

  readonly completionStatus = computed<CompletionStatus>(() => {
    const exercise = this.currentExercise();
    if (exercise?.completed) return 'confirmed';
    return exercise && this.pendingResults().has(exercise.id) ? 'pending_sync' : 'not_completed';
  });

  readonly pendingExerciseNumbers = computed(() =>
    this.exerciseNumbers((id) => this.pendingResults().has(id) && !this.rejectedResults().has(id)),
  );
  readonly rejectedExerciseNumbers = computed(() => this.exerciseNumbers((id) => this.rejectedResults().has(id)));
  readonly syncingCompletion = computed(() => this.syncingResults().size > 0);

  private exerciseNumbers(matches: (id: string) => boolean): string {
    return (this.session()?.exercises ?? [])
      .flatMap((exercise, index) => matches(exercise.id) ? [index + 1] : [])
      .join(', ');
  }

  /** A generated ("Random practice") session has no Daily Practice Home streak screen to land on and, outside the real Telegram app, no native BackButton either — so it gets its own on-screen back control (the daily session still relies solely on Telegram's native one, by design — see ExercisePageComponent's showContextBack). */
  readonly isGeneratedSession = computed(() => this.session()?.kind === 'generated');

  readonly currentExercise = computed<PracticeExerciseRef | null>(() => {
    const session = this.session();
    const id = this.currentExerciseId();
    return session?.exercises.find((e) => e.id === id) ?? null;
  });

  private readonly currentIndex = computed(() => {
    const session = this.session();
    const current = this.currentExercise();
    if (!session || !current) return -1;
    return session.exercises.findIndex((e) => e.id === current.id);
  });

  readonly sessionLabel = computed(() => {
    const session = this.session();
    return session ? `Exercise ${this.currentIndex() + 1} of ${session.exercises.length}` : null;
  });

  readonly isLastExercise = computed(() => {
    const session = this.session();
    return !!session && this.currentIndex() === session.exercises.length - 1;
  });

  readonly currentProgress = computed(() => this.positions().get(this.currentExerciseId() ?? '') ?? null);

  constructor() {
    // `id` (required input) has no value yet during construction — same reason
    // ExercisePageComponent loads via effect() on its own gameId input rather
    // than reading it directly in the constructor body.
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });

    const retryOnline = () => this.retrySync();
    window.addEventListener('online', retryOnline);
    this.destroyRef.onDestroy(() => {
      this.finishSub?.unsubscribe();
      window.removeEventListener('online', retryOnline);
    });
  }

  retry(): void {
    this.load(this.id());
  }

  back(): void {
    this.router.navigate(['/practice']);
  }

  onExerciseSolved(): void {
    const exercise = this.currentExercise();
    if (!exercise || exercise.completed || this.pendingResults().has(exercise.id)) return;

    const pending = new Set(this.pendingResults()).add(exercise.id);
    this.pendingResults.set(pending);
    writePracticeLocal(this.practice.storageAccountId, this.id(), exercise.id, 'result', 'pending');
    this.syncPendingResults();
  }

  private syncPendingResults(): void {
    const session = this.session();
    if (!session || session.id !== this.id()) return;

    const accountId = this.practice.storageAccountId;
    for (const exerciseId of this.pendingResults()) {
      if (this.syncingResults().has(exerciseId) || this.rejectedResults().has(exerciseId)) continue;
      this.syncingResults.update((ids) => new Set(ids).add(exerciseId));
      this.practice.recordResult(session.id, exerciseId).pipe(
        timeout(15000),
        retry({
          count: 2,
          delay: (error) => this.isRetryable(error) ? timer(500) : throwError(() => error),
        }),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.syncingResults.update((ids) => {
          const remaining = new Set(ids);
          remaining.delete(exerciseId);
          return remaining;
        })),
      ).subscribe({
        next: () => {
          writePracticeLocal(accountId, session.id, exerciseId, 'result', null);
          if (this.id() !== session.id || this.session()?.id !== session.id) return;
          this.pendingResults.update((ids) => {
            const remaining = new Set(ids);
            remaining.delete(exerciseId);
            return remaining;
          });
          this.session.update((current) => {
            if (!current) return current;
            const exercises = current.exercises.map((e) => (e.id === exerciseId ? { ...e, completed: true } : e));
            return { ...current, exercises, completed: exercises.every((e) => e.completed) };
          });
          this.finishIfConfirmed();
        },
        error: (error) => {
          console.error(`Failed to record exercise ${exerciseId} as completed`, error);
          if (error instanceof HttpErrorResponse && error.status >= 400 && error.status < 500 &&
              error.status !== 401 && !this.isRetryable(error)) {
            writePracticeLocal(accountId, session.id, exerciseId, 'result', 'rejected');
            if (this.session()?.id === session.id) {
              this.rejectedResults.update((ids) => new Set(ids).add(exerciseId));
            }
          }
        },
      });
    }
  }

  private isRetryable(error: unknown): boolean {
    if (error instanceof TimeoutError) return true;
    return error instanceof HttpErrorResponse
      && (error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500);
  }

  retrySync(): void {
    this.syncPendingResults();
  }

  onProgressChanged(progress: ExerciseProgress): void {
    const exercise = this.currentExercise();
    if (!exercise) return;
    this.positions.update((positions) => new Map(positions).set(exercise.id, progress));
    writePracticeLocal(this.practice.storageAccountId, this.id(), exercise.id, 'position', progress);
  }

  onDailyNext(): void {
    const session = this.session();
    if (!session || this.completionStatus() === 'not_completed') return;

    const next = session.exercises[this.currentIndex() + 1] ??
      session.exercises.find((exercise) => !exercise.completed && !this.pendingResults().has(exercise.id));
    if (next) {
      this.currentExerciseId.set(next.id);
      return;
    }

    this.finishedLocally.set(true);
    this.finishIfConfirmed();
  }

  private finishIfConfirmed(): void {
    const session = this.session();
    if (!this.finishedLocally() || !session?.completed || this.finishSub) return;
    if (session.kind === 'generated') {
      this.router.navigate(['/practice']);
      return;
    }
    this.finishSub = timer(FINISH_PRACTICE_DELAY_MS).subscribe(() =>
      this.router.navigate(['/practice/complete']),
    );
  }

  private load(id: string): void {
    this.loadSub?.unsubscribe();
    this.finishSub?.unsubscribe();
    this.finishSub = undefined;
    this.screen.set('loading');

    const query = this.route.snapshot.queryParamMap;
    const requested = query.get('exerciseId');
    const review = query.get('review') === '1';
    const initialSession = this.startedSession?.id === id ? this.startedSession : undefined;
    this.startedSession = undefined;
    const session$ = initialSession ? of(initialSession) : this.practice.getSession(id);
    this.loadSub = session$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (session) => {
        if (!session || session.exercises.length === 0) {
          this.router.navigate(['/practice']);
          return;
        }

        const accountId = this.practice.storageAccountId;
        const positions = new Map<string, ExerciseProgress>();
        const pending = new Set<string>();
        const rejected = new Set<string>();
        for (const exercise of session.exercises) {
          const position = readPracticePosition(accountId, id, exercise.id);
          if (position) positions.set(exercise.id, position);
          const result = readPracticeLocal(accountId, id, exercise.id, 'result');
          if (exercise.completed) {
            if (result) writePracticeLocal(accountId, id, exercise.id, 'result', null);
          } else if (result === 'pending' || result === 'rejected') {
            pending.add(exercise.id);
            if (result === 'rejected') rejected.add(exercise.id);
          }
        }
        this.positions.set(positions);
        this.pendingResults.set(pending);
        this.rejectedResults.set(rejected);
        this.finishedLocally.set(false);
        this.session.set(session);
        this.retrySync();
        const requestedExercise = requested ? session.exercises.find((e) => e.id === requested) : undefined;
        const start =
          requestedExercise ??
          session.exercises.find((exercise) => isDeepening(positions.get(exercise.id))) ??
          (review ? session.exercises[0] : session.exercises.find((e) => !e.completed && !pending.has(e.id)) ?? session.exercises[0]);
        this.currentExerciseId.set(start.id);
        this.screen.set('ready');
      },
      error: () => this.screen.set('error'),
    });
  }
}
