import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DailyPracticeCardComponent } from './daily-practice-card.component';
import { PracticeService } from '../../../data/practice.service';
import type { DailyPracticeSession } from '../../../data/practice.model';

class StubPracticeService extends PracticeService {
  session: DailyPracticeSession = { date: '2026-01-01', exercises: [], completed: false };

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

  override getPreferences() {
    return of({ topVariants: 3, continuationDepth: 6, exerciseSource: 'own' as const, exerciseCount: 5 });
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

describe('DailyPracticeCardComponent', () => {
  let fixture: ComponentFixture<DailyPracticeCardComponent>;
  let stub: StubPracticeService;

  function create(): ComponentFixture<DailyPracticeCardComponent> {
    TestBed.configureTestingModule({
      imports: [DailyPracticeCardComponent],
      providers: [provideRouter([]), { provide: PracticeService, useClass: StubPracticeService }],
    });
    stub = TestBed.inject(PracticeService) as unknown as StubPracticeService;
    fixture = TestBed.createComponent(DailyPracticeCardComponent);
    return fixture;
  }

  it('renders nothing when there are no exercises available today', () => {
    create().detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });

  it('shows Start Practice with the available count when nothing has been attempted yet', () => {
    stub = new StubPracticeService();
    stub.session = {
      date: '2026-01-01',
      completed: false,
      exercises: [
        { id: 'e1', gameId: 'g1', phase: 'opening', completed: false, opponentName: '', opponentRank: '', boardSize: 19, userSign: 1, moveNumber: 1, topVariants: 3, currentDepth: 4, selectedVariant: null, step: 1 },
        { id: 'e2', gameId: 'g1', phase: 'middlegame', completed: false, opponentName: '', opponentRank: '', boardSize: 19, userSign: 1, moveNumber: 1, topVariants: 3, currentDepth: 4, selectedVariant: null, step: 1 },
      ],
    };
    TestBed.overrideProvider(PracticeService, { useValue: stub });
    create().detectChanges();

    expect(fixture.nativeElement.textContent).toContain('2 exercises ready');
    expect(fixture.nativeElement.textContent).toContain('Start Practice');
  });

  it('shows Continue Practice with progress once at least one exercise is done', () => {
    stub = new StubPracticeService();
    stub.session = {
      date: '2026-01-01',
      completed: false,
      exercises: [
        { id: 'e1', gameId: 'g1', phase: 'opening', completed: true, opponentName: '', opponentRank: '', boardSize: 19, userSign: 1, moveNumber: 1, topVariants: 3, currentDepth: 4, selectedVariant: null, step: 1 },
        { id: 'e2', gameId: 'g1', phase: 'middlegame', completed: false, opponentName: '', opponentRank: '', boardSize: 19, userSign: 1, moveNumber: 1, topVariants: 3, currentDepth: 4, selectedVariant: null, step: 1 },
      ],
    };
    TestBed.overrideProvider(PracticeService, { useValue: stub });
    create().detectChanges();

    expect(fixture.nativeElement.textContent).toContain('1 of 2 done');
    expect(fixture.nativeElement.textContent).toContain('Continue Practice');
  });

  it('shows Practice Complete with no action once every exercise is done', () => {
    stub = new StubPracticeService();
    stub.session = {
      date: '2026-01-01',
      completed: true,
      exercises: [{ id: 'e1', gameId: 'g1', phase: 'opening', completed: true, opponentName: '', opponentRank: '', boardSize: 19, userSign: 1, moveNumber: 1, topVariants: 3, currentDepth: 4, selectedVariant: null, step: 1 }],
    };
    TestBed.overrideProvider(PracticeService, { useValue: stub });
    create().detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Practice Complete');
    expect(fixture.nativeElement.querySelector('a')).toBeNull();
  });
});
