import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { retry } from 'rxjs';
import { PracticeService } from '../data/practice.service';
import type { DailyPracticeSession, PracticeExerciseRef } from '../data/practice.model';
import { ExercisePageComponent } from '../exercise/exercise-page.component';
import type { ExerciseProgress } from '../exercise/exercise-state';
import { PaperBackgroundComponent } from '../shared/paper-background/paper-background.component';

type Screen = 'loading' | 'ready' | 'error';

/**
 * Finish practice (last exercise of a daily session) used to call
 * router.navigate(['/practice/complete']) the instant it was tapped —
 * reported as "Finish practice doesn't leave the stone at the intersection":
 * the final correct move's stone is actually on the board (confirmed by
 * driving the real app), but the board is torn down for the completion
 * screen so abruptly that the player never perceives it having landed. This
 * delay (same idea as ExercisePageComponent's OPPONENT_REPLY_DELAY_MS) gives
 * the finished board a beat on screen before the completion screen replaces it.
 */
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

  readonly id = input.required<string>();

  readonly screen = signal<Screen>('loading');
  private readonly session = signal<DailyPracticeSession | null>(null);
  private readonly currentExerciseId = signal<string | null>(null);
  /** "Review exercises" (handoff section 8): starts at exercise 1 regardless of completion, and never re-records a result — see onExerciseSolved. */
  private readonly reviewMode = signal(false);
  /** Set when Daily Practice Home's exercise list was tapped directly (not Start/Continue practice) — opens that one exercise instead of the first unsolved one. */
  private readonly requestedExerciseId = signal<string | null>(null);

  private readonly destroyRef = inject(DestroyRef);
  private finishTimer?: ReturnType<typeof setTimeout>;

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

  /** The exercise's own saved position (handoff v4-3 section 9) — null starts it fresh. */
  readonly currentProgress = computed<ExerciseProgress | null>(() => {
    const exercise = this.currentExercise();
    return exercise ? { selectedVariant: exercise.selectedVariant, step: exercise.step, currentDepth: exercise.currentDepth } : null;
  });

  constructor() {
    this.reviewMode.set(this.route.snapshot.queryParamMap.get('review') === '1');
    this.requestedExerciseId.set(this.route.snapshot.queryParamMap.get('exerciseId'));
    // `id` (required input) has no value yet during construction — same reason
    // ExercisePageComponent loads via effect() on its own gameId input rather
    // than reading it directly in the constructor body.
    effect(() => this.load(this.id()));

    this.destroyRef.onDestroy(() => clearTimeout(this.finishTimer));
  }

  retry(): void {
    this.load(this.id());
  }

  back(): void {
    this.router.navigate(['/practice']);
  }

  /** ExercisePageComponent's exerciseSolved (handoff section 6) — skipped once already recorded, so reviewing an already-solved exercise never changes the session result (handoff section 8). Retries a few times before giving up: this request failing silently (the previous behaviour — no error handler at all) is indistinguishable from the player's own completed count randomly falling short of what they actually played. */
  onExerciseSolved(): void {
    const exercise = this.currentExercise();
    if (!exercise || exercise.completed) return;

    this.practice
      .recordResult(this.id(), exercise.id)
      .pipe(retry({ count: 2, delay: 500 }))
      .subscribe({
        next: () => {
          this.session.update((session) => {
            if (!session) return session;
            const exercises = session.exercises.map((e) => (e.id === exercise.id ? { ...e, completed: true } : e));
            return { ...session, exercises, completed: exercises.every((e) => e.completed) };
          });
        },
        error: (err) => console.error(`Failed to record exercise ${exercise.id} as completed`, err),
      });
  }

  /** ExercisePageComponent's progressChanged (handoff section 9) — fires after every confirmed move, Try another line and Go deeper. Skipped once already recorded, same as onExerciseSolved, so reviewing never rewrites a finished exercise's position. */
  onProgressChanged(progress: ExerciseProgress): void {
    const exercise = this.currentExercise();
    if (!exercise || exercise.completed) return;

    this.practice
      .saveProgress(this.id(), exercise.id, progress)
      .pipe(retry({ count: 2, delay: 500 }))
      .subscribe({ error: (err) => console.error(`Failed to save progress for exercise ${exercise.id}`, err) });
    this.session.update((session) => {
      if (!session) return session;
      const exercises = session.exercises.map((e) => (e.id === exercise.id ? { ...e, ...progress } : e));
      return { ...session, exercises };
    });
  }

  /** LineCompleteActions' primary button, "Next exercise"/"Finish practice" (handoff section 6). */
  onDailyNext(): void {
    const session = this.session();
    const current = this.currentExercise();
    if (!session || !current) return;

    const next = session.exercises[this.currentIndex() + 1];
    if (next) {
      this.currentExerciseId.set(next.id);
      return;
    }

    if (session.kind === 'daily') {
      // Finish practice (last exercise) saves the session and opens the completion
      // screen; Done there returns to Games (handoff v4-3-kaizen-daily-practice section 6/8).
      // Delayed (FINISH_PRACTICE_DELAY_MS) so the just-played final stone has a beat
      // on screen before the board is replaced by the completion screen.
      clearTimeout(this.finishTimer);
      this.finishTimer = setTimeout(() => this.router.navigate(['/practice/complete']), FINISH_PRACTICE_DELAY_MS);
    } else {
      // A generated ("Random practice") session never affects the streak, so it gets
      // no completion screen — just back to the session list on Daily Practice Home.
      this.router.navigate(['/practice']);
    }
  }

  private load(id: string): void {
    this.screen.set('loading');

    this.practice.getSession(id).subscribe({
      next: (session) => {
        if (!session || session.exercises.length === 0) {
          this.router.navigate(['/practice']);
          return;
        }

        this.session.set(session);
        const requested = this.requestedExerciseId();
        const requestedExercise = requested ? session.exercises.find((e) => e.id === requested) : undefined;
        const start =
          requestedExercise ??
          (this.reviewMode() ? session.exercises[0] : session.exercises.find((e) => !e.completed) ?? session.exercises[0]);
        this.currentExerciseId.set(start.id);
        this.screen.set('ready');
      },
      error: () => this.screen.set('error'),
    });
  }
}
