import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PracticeService } from '../data/practice.service';
import type { DailyPracticeSession, PracticeExerciseRef } from '../data/practice.model';
import { ExercisePageComponent } from '../exercise/exercise-page.component';
import type { ExerciseProgress } from '../exercise/exercise-state';
import { PaperBackgroundComponent } from '../shared/paper-background/paper-background.component';

type Screen = 'loading' | 'ready' | 'error';

/**
 * The thin Daily Practice session wrapper (handoff v4-kaizen-daily-practice
 * section 6/11, replacing the old DailyPracticeSessionComponent): walks the
 * session's exercises by rebinding ExercisePageComponent's gameId/phase per
 * exercise, exactly the reusability hooks that component's own inputs/
 * outputs were built for — it owns session-position arithmetic and
 * PracticeService recording, nothing about the board/engine itself.
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

  readonly screen = signal<Screen>('loading');
  private readonly session = signal<DailyPracticeSession | null>(null);
  private readonly currentExerciseId = signal<string | null>(null);
  /** "Review exercises" (handoff section 8): starts at exercise 1 regardless of completion, and never re-records a result — see onExerciseSolved. */
  private readonly reviewMode = signal(false);

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
    this.load();
  }

  retry(): void {
    this.load();
  }

  /** ExercisePageComponent's exerciseSolved (handoff section 6) — skipped once already recorded, so reviewing an already-solved exercise never changes the session result (handoff section 8). */
  onExerciseSolved(): void {
    const exercise = this.currentExercise();
    if (!exercise || exercise.completed) return;

    this.practice.recordResult(exercise.id).subscribe(() => {
      this.session.update((session) => {
        if (!session) return session;
        const exercises = session.exercises.map((e) => (e.id === exercise.id ? { ...e, completed: true } : e));
        return { ...session, exercises, completed: exercises.every((e) => e.completed) };
      });
    });
  }

  /** ExercisePageComponent's progressChanged (handoff section 9) — fires after every confirmed move, Try another line and Go deeper. Skipped once already recorded, same as onExerciseSolved, so reviewing never rewrites a finished exercise's position. */
  onProgressChanged(progress: ExerciseProgress): void {
    const exercise = this.currentExercise();
    if (!exercise || exercise.completed) return;

    this.practice.saveProgress(exercise.id, progress).subscribe();
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
    } else {
      // Finish practice (last exercise) saves the session and opens the completion
      // screen; Done there returns to Games (handoff v4-3-kaizen-daily-practice section 6/8).
      this.router.navigate(['/practice/complete']);
    }
  }

  private load(): void {
    this.screen.set('loading');

    this.practice.startTodaySession().subscribe({
      next: (session) => {
        if (session.exercises.length === 0) {
          this.router.navigate(['/practice']);
          return;
        }

        this.session.set(session);
        const start = this.reviewMode() ? session.exercises[0] : session.exercises.find((e) => !e.completed) ?? session.exercises[0];
        this.currentExerciseId.set(start.id);
        this.screen.set('ready');
      },
      error: () => this.screen.set('error'),
    });
  }
}
