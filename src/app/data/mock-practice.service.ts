import { Injectable, inject } from '@angular/core';
import { map, Observable, of, switchMap } from 'rxjs';
import { GameHistoryService } from './game-history.service';
import type { GameHistoryDto } from './game-history.model';
import { PracticePoolService } from './practice-pool.service';
import { PracticeService } from './practice.service';
import { DEFAULT_PRACTICE_PREFERENCES, type DailyPracticeSession, type PracticePreferences, type StreakInfo } from './practice.model';
import type { ExerciseProgress } from '../exercise/exercise-state';
import { SgfParserService } from '../sgf/sgf-parser.service';
import { cloneSession, pickExercises, todayIso } from './practice-exercise-picker';

/**
 * Session-local Daily Practice backend, no network — built on top of
 * whichever GameHistoryService is configured (the real mock fixtures in
 * dev), so exercises are picked the same way a real backend would: from
 * analysed games' phase SGFs that actually have a usable branch point
 * (buildExerciseTree doesn't throw). Resets on page reload — there is no
 * real persistence here, see docs/backend-contract/daily-practice-endpoint-proposal.md.
 */
@Injectable()
export class MockPracticeService extends PracticeService {
  private readonly gameHistory = inject(GameHistoryService);
  private readonly sgfParser = inject(SgfParserService);
  private readonly practicePool = inject(PracticePoolService);

  private session: DailyPracticeSession | null = null;
  private preferences: PracticePreferences = { ...DEFAULT_PRACTICE_PREFERENCES };

  getTodaySession(): Observable<DailyPracticeSession | null> {
    return of(this.session ? cloneSession(this.session) : null);
  }

  startTodaySession(): Observable<DailyPracticeSession> {
    if (this.session) return of(cloneSession(this.session));

    return this.gameHistory.listGames().pipe(
      switchMap((dtos) => this.candidatePool(dtos)),
      map((candidates) => {
        const exercises = pickExercises(this.sgfParser, candidates, {
          count: this.preferences.exerciseCount,
          topVariants: this.preferences.topVariants,
          continuationDepth: this.preferences.continuationDepth,
        });
        this.session = { date: todayIso(), exercises, completed: exercises.length === 0 };
        return cloneSession(this.session);
      }),
    );
  }

  /** Always regenerates, unlike startTodaySession — shuffled, so it visibly varies call to call even against the mock's own small fixed pool. */
  startNewRound(): Observable<DailyPracticeSession> {
    return this.gameHistory.listGames().pipe(
      switchMap((dtos) => this.candidatePool(dtos)),
      map((candidates) => {
        const exercises = pickExercises(this.sgfParser, candidates, {
          count: this.preferences.exerciseCount,
          shuffled: true,
          topVariants: this.preferences.topVariants,
          continuationDepth: this.preferences.continuationDepth,
        });
        this.session = { date: todayIso(), exercises, completed: exercises.length === 0 };
        return cloneSession(this.session);
      }),
    );
  }

  /**
   * "Random practice" — unlike every other session-building method here,
   * this ignores the chat's own games and the exerciseSource preference
   * entirely: the whole session comes from the bundled practice-pool, purely
   * for testing (see PracticeService.startRandomPractice's own doc comment).
   * Still honors the exerciseCount preference, same as a normal session.
   */
  startRandomPractice(): Observable<DailyPracticeSession> {
    return this.practicePool.pool$.pipe(
      map((pool) => {
        const exercises = pickExercises(this.sgfParser, pool, {
          count: this.preferences.exerciseCount,
          shuffled: true,
          topVariants: this.preferences.topVariants,
          continuationDepth: this.preferences.continuationDepth,
        });
        this.session = { date: todayIso(), exercises, completed: exercises.length === 0 };
        return cloneSession(this.session);
      }),
    );
  }

  /**
   * 'own' (default): just the chat's own games. 'mixed': the chat's own games
   * first, padded with the practice-pool so a thin own-games pool still
   * fills a session.
   */
  private candidatePool(dtos: GameHistoryDto[]): Observable<GameHistoryDto[]> {
    if (this.preferences.exerciseSource !== 'mixed') return of(dtos);
    return this.practicePool.pool$.pipe(map((pool) => [...dtos, ...pool]));
  }

  recordResult(exerciseId: string): Observable<void> {
    const exercise = this.session?.exercises.find((e) => e.id === exerciseId);
    if (exercise && this.session) {
      exercise.completed = true;
      this.session.completed = this.session.exercises.every((e) => e.completed);
    }
    return of(undefined);
  }

  saveProgress(exerciseId: string, progress: ExerciseProgress): Observable<void> {
    const exercise = this.session?.exercises.find((e) => e.id === exerciseId);
    if (exercise) {
      exercise.selectedVariant = progress.selectedVariant;
      exercise.step = progress.step;
      exercise.currentDepth = progress.currentDepth;
    }
    return of(undefined);
  }

  getPreferences(): Observable<PracticePreferences> {
    return of({ ...this.preferences });
  }

  setPreferences(preferences: PracticePreferences): Observable<void> {
    this.preferences = { ...preferences };
    return of(undefined);
  }

  /** No real multi-day persistence in the mock — just reflects whether today's session is done. */
  getStreak(): Observable<StreakInfo> {
    const doneToday = this.session?.completed ?? false;
    return of({ currentStreak: doneToday ? 1 : 0, last7Days: [false, false, false, false, false, false, doneToday] });
  }
}
