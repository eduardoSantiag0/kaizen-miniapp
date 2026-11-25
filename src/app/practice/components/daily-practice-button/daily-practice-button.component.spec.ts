import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DailyPracticeButtonComponent } from './daily-practice-button.component';
import { PracticeService } from '../../../data/practice.service';
import type { DailyPracticeSession, PracticeExerciseRef } from '../../../data/practice.model';

function exerciseRef(overrides: Partial<PracticeExerciseRef> & Pick<PracticeExerciseRef, 'id' | 'gameId' | 'phase'>): PracticeExerciseRef {
  return {
    completed: false,
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
  session: DailyPracticeSession = { id: 's1', kind: 'daily', date: '2026-01-01', exercises: [], completed: false };
  startTodaySessionCalls = 0;
  startTodaySessionError = false;

  override getTodaySession() {
    return of(this.session);
  }

  override startTodaySession() {
    this.startTodaySessionCalls++;
    return this.startTodaySessionError ? throwError(() => new Error('network error')) : of(this.session);
  }

  override startNewRound() {
    return of(this.session);
  }

  override startRandomPractice() {
    return of(this.session);
  }

  override listSessions() {
    return of([this.session]);
  }

  override getSession() {
    return of(this.session);
  }

  override recordResult() {
    return of(undefined);
  }

  override getPreferences() {
    return of({ topVariants: 3, continuationDepth: 4, exerciseSource: 'own' as const, exerciseCount: 5 });
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

describe('DailyPracticeButtonComponent', () => {
  let fixture: ComponentFixture<DailyPracticeButtonComponent>;
  let stub: StubPracticeService;

  function create(): ComponentFixture<DailyPracticeButtonComponent> {
    TestBed.configureTestingModule({
      imports: [DailyPracticeButtonComponent],
      providers: [provideRouter([]), { provide: PracticeService, useClass: StubPracticeService }],
    });
    stub = TestBed.inject(PracticeService) as unknown as StubPracticeService;
    fixture = TestBed.createComponent(DailyPracticeButtonComponent);
    return fixture;
  }

  it('renders nothing when no game has a mistake to practise', () => {
    create().detectChanges();
    expect(fixture.nativeElement.querySelector('a')).toBeNull();
  });

  it('shows the exercise count and links to /practice before starting', () => {
    stub = new StubPracticeService();
    stub.session = {
      id: 's1',
      kind: 'daily',
      date: '2026-01-01',
      completed: false,
      exercises: [
        exerciseRef({ id: 'e1', gameId: 'g1', phase: 'opening' }),
        exerciseRef({ id: 'e2', gameId: 'g1', phase: 'middlegame' }),
        exerciseRef({ id: 'e3', gameId: 'g1', phase: 'endgame' }),
      ],
    };
    TestBed.overrideProvider(PracticeService, { useValue: stub });
    create().detectChanges();

    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('ng-reflect-router-link') ?? link.getAttribute('href')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('3 exercises today');
    expect(link.getAttribute('aria-label')).toBe('Daily practice: 3 exercises today');
  });

  it('shows progress once at least one exercise is solved', () => {
    stub = new StubPracticeService();
    stub.session = {
      id: 's1',
      kind: 'daily',
      date: '2026-01-01',
      completed: false,
      exercises: [
        exerciseRef({ id: 'e1', gameId: 'g1', phase: 'opening', completed: true }),
        exerciseRef({ id: 'e2', gameId: 'g1', phase: 'middlegame' }),
        exerciseRef({ id: 'e3', gameId: 'g1', phase: 'endgame' }),
      ],
    };
    TestBed.overrideProvider(PracticeService, { useValue: stub });
    create().detectChanges();

    expect(fixture.nativeElement.textContent).toContain('1 of 3 done');
  });

  it('shows "Done for today" once every exercise is solved, every track node filled', () => {
    stub = new StubPracticeService();
    stub.session = {
      id: 's1',
      kind: 'daily',
      date: '2026-01-01',
      completed: true,
      exercises: [exerciseRef({ id: 'e1', gameId: 'g1', phase: 'opening', completed: true })],
    };
    TestBed.overrideProvider(PracticeService, { useValue: stub });
    create().detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Done for today');
    expect(fixture.nativeElement.querySelectorAll('.kz-track-node--ahead').length).toBe(0);
  });

  it('shows a retry affordance instead of silently vanishing when the session fails to load', () => {
    stub = new StubPracticeService();
    stub.startTodaySessionError = true;
    TestBed.overrideProvider(PracticeService, { useValue: stub });
    create().detectChanges();

    expect(fixture.nativeElement.querySelector('a')).toBeNull();
    const retryButton = fixture.nativeElement.querySelector('.kz-daily-error') as HTMLButtonElement;
    expect(retryButton).not.toBeNull();

    stub.startTodaySessionError = false;
    stub.session = { id: 's1', kind: 'daily', date: '2026-01-01', completed: false, exercises: [exerciseRef({ id: 'e1', gameId: 'g1', phase: 'opening' })] };
    retryButton.click();
    fixture.detectChanges();

    expect(stub.startTodaySessionCalls).toBe(2);
    expect(fixture.nativeElement.querySelector('.kz-daily-error')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('1 exercise today');
  });

});
