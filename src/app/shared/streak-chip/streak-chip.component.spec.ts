import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { StreakChipComponent } from './streak-chip.component';
import { PracticeService } from '../../data/practice.service';
import type { DailyPracticeSession } from '../../data/practice.model';

class StubPracticeService extends PracticeService {
  streak = { currentStreak: 0, last7Days: [false, false, false, false, false, false, false] };
  streakError = false;
  getStreakCalls = 0;

  override getTodaySession() {
    return of(null);
  }

  override startTodaySession() {
    return of({ id: 's1', kind: 'daily' as const, date: '2026-01-01', exercises: [], completed: false } as DailyPracticeSession);
  }

  override startNewRound() {
    return this.startTodaySession();
  }

  override startRandomPractice() {
    return this.startTodaySession();
  }

  override listSessions() {
    return of([]);
  }

  override getSession() {
    return of(null);
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
    this.getStreakCalls++;
    return this.streakError ? throwError(() => new Error('network error')) : of(this.streak);
  }
}

describe('StreakChipComponent', () => {
  let fixture: ComponentFixture<StreakChipComponent>;
  let stub: StubPracticeService;

  function create(): ComponentFixture<StreakChipComponent> {
    TestBed.configureTestingModule({
      imports: [StreakChipComponent],
      providers: [provideRouter([]), { provide: PracticeService, useClass: StubPracticeService }],
    });
    stub = TestBed.inject(PracticeService) as unknown as StubPracticeService;
    fixture = TestBed.createComponent(StreakChipComponent);
    return fixture;
  }

  it('is hidden at 0', () => {
    create().detectChanges();
    expect(fixture.nativeElement.querySelector('a')).toBeNull();
  });

  it('is hidden on a load error, rather than showing a stale/wrong count', () => {
    stub = new StubPracticeService();
    stub.streakError = true;
    TestBed.overrideProvider(PracticeService, { useValue: stub });
    create().detectChanges();

    expect(fixture.nativeElement.querySelector('a')).toBeNull();
  });

  it('shows the count and links to /practice/complete once positive', () => {
    stub = new StubPracticeService();
    stub.streak = { currentStreak: 4, last7Days: [false, false, false, true, true, true, true] };
    TestBed.overrideProvider(PracticeService, { useValue: stub });
    create().detectChanges();

    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('ng-reflect-router-link') ?? link.getAttribute('href')).toContain('/practice/complete');
    expect(link.getAttribute('aria-label')).toBe('Streak: 4 days in a row');
    expect(fixture.nativeElement.textContent).toContain('4');
    expect(fixture.nativeElement.textContent).toContain('days');
  });

  it('says "day" (singular) at 1', () => {
    stub = new StubPracticeService();
    stub.streak = { currentStreak: 1, last7Days: [false, false, false, false, false, false, true] };
    TestBed.overrideProvider(PracticeService, { useValue: stub });
    create().detectChanges();

    expect(fixture.nativeElement.querySelector('a')?.getAttribute('aria-label')).toBe('Streak: 1 day in a row');
  });

  it('refreshes on visibilitychange — Telegram can suspend this page mid-request or across a day boundary', () => {
    stub = new StubPracticeService();
    stub.streak = { currentStreak: 4, last7Days: [false, false, false, false, true, true, true] };
    TestBed.overrideProvider(PracticeService, { useValue: stub });
    create().detectChanges();
    expect(stub.getStreakCalls).toBe(1);

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(stub.getStreakCalls).toBe(2);
  });
});
