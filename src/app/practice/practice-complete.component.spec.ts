import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { PracticeCompleteComponent } from './practice-complete.component';
import { PracticeService } from '../data/practice.service';
import type { DailyPracticeSession, PracticeExerciseRef, StreakInfo } from '../data/practice.model';

function exerciseRef(overrides: Partial<PracticeExerciseRef> & Pick<PracticeExerciseRef, 'id'>): PracticeExerciseRef {
  return {
    gameId: 'g1',
    phase: 'opening',
    completed: true,
    opponentName: 'kitsune77',
    opponentRank: '4k',
    boardSize: 19,
    userSign: 1,
    moveNumber: 75,
    topVariants: 3,
    currentDepth: 4,
    selectedVariant: null,
    step: 1,
    ...overrides,
  };
}

class StubPracticeService extends PracticeService {
  session: DailyPracticeSession = { date: '2026-01-01', exercises: [], completed: true };
  streak: StreakInfo = { currentStreak: 1, last7Days: [false, false, false, false, false, false, true] };

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

  override recordResult() {
    return of(undefined);
  }

  override saveProgress() {
    return of(undefined);
  }

  override getPreferences() {
    return of({ topVariants: 3, continuationDepth: 4, exerciseSource: 'own' as const, exerciseCount: 5 });
  }

  override setPreferences() {
    return of(undefined);
  }

  override getStreak() {
    return of(this.streak);
  }
}

describe('PracticeCompleteComponent', () => {
  let fixture: ComponentFixture<PracticeCompleteComponent>;
  let stub: StubPracticeService;

  beforeEach(() => {
    delete window.Telegram;
  });

  function create(session: DailyPracticeSession, streak: StreakInfo): ComponentFixture<PracticeCompleteComponent> {
    TestBed.configureTestingModule({
      imports: [PracticeCompleteComponent],
      providers: [provideRouter([]), { provide: PracticeService, useClass: StubPracticeService }],
    });
    stub = TestBed.inject(PracticeService) as unknown as StubPracticeService;
    stub.session = session;
    stub.streak = streak;
    fixture = TestBed.createComponent(PracticeCompleteComponent);
    return fixture;
  }

  it('shows "Your streak starts today" on the first day, with no number', () => {
    create(
      { date: '2026-01-01', completed: true, exercises: [exerciseRef({ id: 'e1' })] },
      { currentStreak: 1, last7Days: [false, false, false, false, false, false, true] },
    ).detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Your streak starts today');
    expect(fixture.componentInstance.headlineNumber()).toBeNull();
  });

  it('shows the plain count once the streak is more than one day', () => {
    create(
      { date: '2026-01-01', completed: true, exercises: [exerciseRef({ id: 'e1' }), exerciseRef({ id: 'e2' })] },
      { currentStreak: 5, last7Days: [false, false, true, true, true, true, true] },
    ).detectChanges();

    expect(fixture.componentInstance.headlineNumber()).toBe(5);
    expect(fixture.nativeElement.textContent).toContain('days in a row');
    expect(fixture.nativeElement.textContent).toContain('all 2 exercises done');
    expect(fixture.nativeElement.textContent).toContain('Come back tomorrow to make it');
    expect(fixture.componentInstance.nextStreakNumber()).toBe(6);
  });

  it('no stats, points or ranks — only the completed count appears in the feedback line', () => {
    create(
      { date: '2026-01-01', completed: true, exercises: [exerciseRef({ id: 'e1' })] },
      { currentStreak: 1, last7Days: [false, false, false, false, false, false, true] },
    ).detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('first try');
    expect(fixture.nativeElement.textContent).not.toContain('incorrect');
  });

  it('Done navigates to Games', () => {
    create(
      { date: '2026-01-01', completed: true, exercises: [exerciseRef({ id: 'e1' })] },
      { currentStreak: 1, last7Days: [false, false, false, false, false, false, true] },
    ).detectChanges();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    (fixture.nativeElement.querySelector('.kz-complete-done') as HTMLButtonElement).click();

    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('BackButton also returns to Games', () => {
    create(
      { date: '2026-01-01', completed: true, exercises: [exerciseRef({ id: 'e1' })] },
      { currentStreak: 1, last7Days: [false, false, false, false, false, false, true] },
    ).detectChanges();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    fixture.componentInstance.done();

    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });
});
