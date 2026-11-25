import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PracticeSessionComponent } from './practice-session.component';
import { PracticeService } from '../data/practice.service';
import type { DailyPracticeSession, PracticeExerciseRef, PracticePreferences } from '../data/practice.model';
import type { ExerciseProgress } from '../exercise/exercise-state';
import { GameHistoryService } from '../data/game-history.service';
import type { GameHistoryDto } from '../data/game-history.model';
import { TelegramService } from '../core/telegram.service';

// Two user (Black) moves each: ec/fc, then gc/fd — distinct branch SGFs per game so the two games in a session don't collide.
const SGF_A = '(;FF[4]SZ[9]AB[cc]AW[gg]PL[B](;B[ec];W[fc];B[ed])(;B[fc]))';
const SGF_B = '(;FF[4]SZ[9]AB[cc]AW[gg]PL[B](;B[gc];W[fc];B[gd])(;B[fc]))';

function exerciseRef(overrides: Partial<PracticeExerciseRef> & Pick<PracticeExerciseRef, 'id' | 'gameId'>): PracticeExerciseRef {
  return {
    phase: 'opening',
    completed: false,
    opponentName: 'kitsune77',
    opponentRank: '4k',
    boardSize: 9,
    userSign: 1,
    moveNumber: 1,
    topVariants: 3,
    currentDepth: 4,
    selectedVariant: null,
    step: 1,
    ...overrides,
  };
}

class StubPracticeService extends PracticeService {
  session: DailyPracticeSession = { date: '2026-01-01', exercises: [], completed: false };
  preferences: PracticePreferences = { topVariants: 3, continuationDepth: 4, exerciseSource: 'own' as const, exerciseCount: 5 };
  recordedResults: { id: string }[] = [];
  savedProgress: { id: string; progress: ExerciseProgress }[] = [];

  override getTodaySession() {
    return of(this.session);
  }

  override startTodaySession() {
    return of(this.session);
  }

  override startNewRound() {
    return of(this.session);
  }

  override startRandomPractice() {
    return of(this.session);
  }

  override recordResult(exerciseId: string) {
    this.recordedResults.push({ id: exerciseId });
    const exercise = this.session.exercises.find((e) => e.id === exerciseId);
    if (exercise) {
      exercise.completed = true;
    }
    return of(undefined);
  }

  override getPreferences() {
    return of({ ...this.preferences });
  }

  override setPreferences() {
    return of(undefined);
  }

  override saveProgress(exerciseId: string, progress: ExerciseProgress) {
    this.savedProgress.push({ id: exerciseId, progress });
    const exercise = this.session.exercises.find((e) => e.id === exerciseId);
    if (exercise) {
      exercise.selectedVariant = progress.selectedVariant;
      exercise.step = progress.step;
      exercise.currentDepth = progress.currentDepth;
    }
    return of(undefined);
  }

  override getStreak() {
    return of({ currentStreak: 0, last7Days: [false, false, false, false, false, false, false] });
  }
}

class StubGameHistoryService extends GameHistoryService {
  dtos: Record<string, GameHistoryDto> = {
    g1: {
      id: 'g1',
      correlationId: 'c1',
      openingAnalysed: SGF_A,
      middlegameAnalysed: null,
      endgameAnalysed: null,
      blackPlayer: null,
      whitePlayer: null,
      gameRank: null,
    },
    g2: {
      id: 'g2',
      correlationId: 'c2',
      openingAnalysed: SGF_B,
      middlegameAnalysed: null,
      endgameAnalysed: null,
      blackPlayer: null,
      whitePlayer: null,
      gameRank: null,
    },
  };

  override getGameHistory(gameId: string) {
    return of(this.dtos[gameId]);
  }

  override listGames() {
    return of(Object.values(this.dtos));
  }

  override resignGame() {
    return of(undefined);
  }
}

describe('PracticeSessionComponent', () => {
  let fixture: ComponentFixture<PracticeSessionComponent>;
  let stub: StubPracticeService;

  beforeEach(() => {
    delete window.Telegram;
  });

  function create(session: DailyPracticeSession, review = false): ComponentFixture<PracticeSessionComponent> {
    TestBed.configureTestingModule({
      imports: [PracticeSessionComponent],
      providers: [
        provideRouter([]),
        { provide: PracticeService, useClass: StubPracticeService },
        { provide: GameHistoryService, useClass: StubGameHistoryService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(review ? { review: '1' } : {}) } },
        },
      ],
    });
    stub = TestBed.inject(PracticeService) as unknown as StubPracticeService;
    stub.session = session;
    fixture = TestBed.createComponent(PracticeSessionComponent);
    return fixture;
  }

  it('opens the first unsolved exercise, not the first in session order', fakeAsync(() => {
    create({
      date: '2026-01-01',
      completed: false,
      exercises: [
        exerciseRef({ id: 'e1', gameId: 'g1', completed: true }),
        exerciseRef({ id: 'e2', gameId: 'g2' }),
      ],
    });
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(fixture.componentInstance.currentExercise()?.id).toBe('e2');
    expect(fixture.componentInstance.sessionLabel()).toBe('Exercise 2 of 2');
  }));

  it('review mode always opens exercise 1, even when every exercise is already solved', fakeAsync(() => {
    create(
      {
        date: '2026-01-01',
        completed: true,
        exercises: [
          exerciseRef({ id: 'e1', gameId: 'g1', completed: true }),
          exerciseRef({ id: 'e2', gameId: 'g2', completed: true }),
        ],
      },
      true,
    );
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(fixture.componentInstance.currentExercise()?.id).toBe('e1');
  }));

  it('records the result through PracticeService when a fresh exercise is solved', fakeAsync(() => {
    create({
      date: '2026-01-01',
      completed: false,
      exercises: [exerciseRef({ id: 'e1', gameId: 'g1' })],
    });
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    fixture.componentInstance.onExerciseSolved();

    expect(stub.recordedResults).toEqual([{ id: 'e1' }]);
  }));

  it('never re-records a result for an already-completed exercise (review mode)', fakeAsync(() => {
    create(
      {
        date: '2026-01-01',
        completed: true,
        exercises: [exerciseRef({ id: 'e1', gameId: 'g1', completed: true })],
      },
      true,
    );
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    fixture.componentInstance.onExerciseSolved();

    expect(stub.recordedResults).toEqual([]);
  }));

  it('onDailyNext advances to the next exercise, and opens the completion screen on the last one', fakeAsync(() => {
    create({
      date: '2026-01-01',
      completed: false,
      exercises: [exerciseRef({ id: 'e1', gameId: 'g1' }), exerciseRef({ id: 'e2', gameId: 'g2' })],
    });
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(fixture.componentInstance.currentExercise()?.id).toBe('e1');
    expect(fixture.componentInstance.isLastExercise()).toBe(false);

    fixture.componentInstance.onDailyNext();
    expect(fixture.componentInstance.currentExercise()?.id).toBe('e2');
    expect(fixture.componentInstance.isLastExercise()).toBe(true);

    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    fixture.componentInstance.onDailyNext();
    expect(router.navigate).toHaveBeenCalledWith(['/practice/complete']);
  }));

  it('onProgressChanged saves through PracticeService and updates the local session', fakeAsync(() => {
    create({
      date: '2026-01-01',
      completed: false,
      exercises: [exerciseRef({ id: 'e1', gameId: 'g1' })],
    });
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    stub.savedProgress = []; // ExercisePageComponent also autosaves its initial state on load — isolate the call under test.

    fixture.componentInstance.onProgressChanged({ selectedVariant: 0, step: 2, currentDepth: 6 });

    expect(stub.savedProgress).toEqual([{ id: 'e1', progress: { selectedVariant: 0, step: 2, currentDepth: 6 } }]);
    expect(fixture.componentInstance.currentExercise()?.selectedVariant).toBe(0);
    expect(fixture.componentInstance.currentExercise()?.step).toBe(2);
    expect(fixture.componentInstance.currentExercise()?.currentDepth).toBe(6);
  }));

  it('onProgressChanged never rewrites an already-completed exercise (review mode)', fakeAsync(() => {
    create(
      {
        date: '2026-01-01',
        completed: true,
        exercises: [exerciseRef({ id: 'e1', gameId: 'g1', completed: true, step: 3 })],
      },
      true,
    );
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    fixture.componentInstance.onProgressChanged({ selectedVariant: 1, step: 1, currentDepth: 4 });

    expect(stub.savedProgress).toEqual([]);
  }));

  it('passes the exercise its own saved position as the resume progress', fakeAsync(() => {
    create({
      date: '2026-01-01',
      completed: false,
      exercises: [exerciseRef({ id: 'e1', gameId: 'g1', selectedVariant: 0, step: 2, currentDepth: 6 })],
    });
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(fixture.componentInstance.currentProgress()).toEqual({ selectedVariant: 0, step: 2, currentDepth: 6 });
  }));

  it('renders the exercise-page for the current exercise, with Telegram back returning to /practice (daily mode)', fakeAsync(() => {
    create({ date: '2026-01-01', completed: false, exercises: [exerciseRef({ id: 'e1', gameId: 'g1' })] });
    const telegram = TestBed.inject(TelegramService);
    spyOn(telegram, 'showBackButton');
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('kz-exercise-page')).not.toBeNull();
    expect(telegram.showBackButton).toHaveBeenCalled();
  }));
});
