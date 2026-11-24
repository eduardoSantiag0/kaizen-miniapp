import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DailyPracticeSessionComponent } from './daily-practice-session.component';
import { GameHistoryService } from '../data/game-history.service';
import { PracticeService } from '../data/practice.service';
import type { DailyPracticeSession } from '../data/practice.model';
import type { GameHistoryDto } from '../data/game-history.model';

const EXERCISE_SGF_1 = '(;FF[4]SZ[9]AB[cc]PL[B](;B[ec])(;B[fc]))'; // single-ply variants -> 'done' on the first move
const EXERCISE_SGF_2 = '(;FF[4]SZ[9]AB[cc]PL[B](;B[gc])(;B[hc]))';

function dto(sgf: string): GameHistoryDto {
  return {
    id: 'g',
    correlationId: 'c',
    openingAnalysed: sgf,
    middlegameAnalysed: null,
    endgameAnalysed: null,
    blackPlayer: null,
    whitePlayer: null,
    gameRank: null,
  };
}

class StubGameHistoryService extends GameHistoryService {
  override getGameHistory(gameId: string) {
    return of(dto(gameId === 'g1' ? EXERCISE_SGF_1 : EXERCISE_SGF_2));
  }

  override listGames() {
    return of([]);
  }

  override resignGame() {
    return of(undefined);
  }
}

class StubPracticeService extends PracticeService {
  session: DailyPracticeSession = {
    date: '2026-01-01',
    completed: false,
    exercises: [
      { id: 'e1', gameId: 'g1', phase: 'opening', completed: false, opponentName: '', opponentRank: '', boardSize: 19, userSign: 1, moveNumber: 1, topVariants: 3, currentDepth: 4, selectedVariant: null, step: 1 },
      { id: 'e2', gameId: 'g2', phase: 'opening', completed: false, opponentName: '', opponentRank: '', boardSize: 19, userSign: 1, moveNumber: 1, topVariants: 3, currentDepth: 4, selectedVariant: null, step: 1 },
    ],
  };

  override getTodaySession() {
    return of(this.session);
  }

  override startTodaySession() {
    return of(this.session);
  }

  override recordResult(exerciseId: string) {
    const exercises = this.session.exercises.map((e) =>
      e.id === exerciseId ? { ...e, completed: true } : e,
    );
    this.session = { ...this.session, exercises, completed: exercises.every((e) => e.completed) };
    return of(undefined);
  }

  override getPreferences() {
    return of({ topVariants: 3, continuationDepth: 6 });
  }

  override setPreferences() {
    return of(undefined);
  }

  override saveProgress() {
    return of(undefined);
  }

  override getStreak() {
    return of({ currentStreak: 0, last7Days: [false, false, false, false, false, false, false] });
  }
}

describe('DailyPracticeSessionComponent', () => {
  let fixture: ComponentFixture<DailyPracticeSessionComponent>;
  let practice: StubPracticeService;

  function create(): ComponentFixture<DailyPracticeSessionComponent> {
    delete window.Telegram;
    TestBed.configureTestingModule({
      imports: [DailyPracticeSessionComponent],
      providers: [
        provideRouter([]),
        { provide: GameHistoryService, useClass: StubGameHistoryService },
        { provide: PracticeService, useClass: StubPracticeService },
      ],
    });
    practice = TestBed.inject(PracticeService) as unknown as StubPracticeService;
    fixture = TestBed.createComponent(DailyPracticeSessionComponent);
    return fixture;
  }

  it('loads the first incomplete exercise and reaches the ready screen', () => {
    create().detectChanges();
    expect(fixture.componentInstance.screen()).toBe('ready');
    expect(fixture.componentInstance.tree()).not.toBeNull();
  });

  it('records a correct first-try result and advances through Next Exercise to the completion summary', () => {
    create().detectChanges();

    fixture.componentInstance.onVertexTap([4, 2]); // ec, variant 0 of g1 -> done
    expect(fixture.componentInstance.state().phase).toBe('done');

    fixture.componentInstance.onNextExercise();
    fixture.detectChanges();
    expect(fixture.componentInstance.screen()).toBe('ready'); // now on g2's exercise

    fixture.componentInstance.onVertexTap([6, 2]); // gc, variant 0 of g2 -> done
    expect(fixture.componentInstance.state().phase).toBe('done');

    fixture.componentInstance.onNextExercise(); // no more exercises -> summary
    expect(fixture.componentInstance.screen()).toBe('summary');

    const summary = fixture.componentInstance.summary();
    expect(summary.completed).toBe(2);
  });

  it('a wrong move before the correct one still lets the exercise finish, but not as a first-try correct', () => {
    create().detectChanges();

    fixture.componentInstance.onVertexTap([1, 1]); // bb, not offered by either variant -> wrong
    expect(fixture.componentInstance.state().phase).toBe('wrong');

    fixture.componentInstance.onUndo();
    fixture.componentInstance.onVertexTap([4, 2]); // ec, now correct -> done
    expect(fixture.componentInstance.state().phase).toBe('done');

    fixture.componentInstance.onNextExercise();
    fixture.componentInstance.onVertexTap([6, 2]);
    fixture.componentInstance.onNextExercise();

    const summary = fixture.componentInstance.summary();
    expect(summary.completed).toBe(2);
  });

  it('Try Another Line resets the exercise without recording a second result', () => {
    create().detectChanges();

    fixture.componentInstance.onVertexTap([4, 2]); // done
    fixture.componentInstance.onTryAnotherLine();

    expect(fixture.componentInstance.state().phase).toBe('play');
    expect(fixture.componentInstance.state().selectedVariant).toBeNull();
    expect(practice.session.exercises[0].completed).toBe(true); // already recorded, unaffected
  });
});
