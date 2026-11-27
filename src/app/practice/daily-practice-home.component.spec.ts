import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DailyPracticeHomeComponent } from './daily-practice-home.component';
import { PracticeService } from '../data/practice.service';
import type { DailyPracticeSession, PracticeExerciseRef, PracticePreferences } from '../data/practice.model';
import { TelegramService } from '../core/telegram.service';

function exerciseRef(overrides: Partial<PracticeExerciseRef> & Pick<PracticeExerciseRef, 'id'>): PracticeExerciseRef {
  return {
    gameId: 'g1',
    phase: 'opening',
    completed: false,
    origin: 'personal',
    sgf: '(;FF[4]SZ[19])',
    opponentName: 'kitsune77',
    opponentRank: '4k',
    boardSize: 19,
    userSign: 1,
    moveNumber: 75,
    topVariants: 3,
    requiredDepth: 4,
    ...overrides,
  };
}

class StubPracticeService extends PracticeService {
  session: DailyPracticeSession = { id: 'daily-1', kind: 'daily', date: '2026-01-01', exercises: [], completed: false };
  /** What startNewRound() returns — defaults to a fresh, uncompleted copy of `session`'s own exercises. */
  newRoundSession: DailyPracticeSession | null = null;
  startNewRoundCalls = 0;
  randomPracticeSession: DailyPracticeSession = { id: 'random-1', kind: 'generated', date: '2026-01-01', exercises: [], completed: false };
  generatedSessions: DailyPracticeSession[] = [];
  startRandomPracticeCalls = 0;
  startRandomPracticeCount: number | null = null;
  preferences: PracticePreferences = { topVariants: 3, continuationDepth: 4, exerciseSource: 'own' as const, exerciseCount: 5 };
  currentStreak = 0;
  startTodaySessionError = false;

  override getTodaySession() {
    return of(this.session);
  }

  override startTodaySession() {
    return this.startTodaySessionError ? throwError(() => new Error('network error')) : of(this.session);
  }

  override startNewRound() {
    this.startNewRoundCalls++;
    const next = this.newRoundSession ?? {
      ...this.session,
      completed: false,
      exercises: this.session.exercises.map((e) => ({ ...e, completed: false })),
    };
    this.session = next;
    return of(next);
  }

  override startRandomPractice(count: number) {
    this.startRandomPracticeCalls++;
    this.startRandomPracticeCount = count;
    this.generatedSessions = [...this.generatedSessions, this.randomPracticeSession];
    return of(this.randomPracticeSession);
  }

  override listSessions() {
    return of({
      sessions: this.generatedSessions.map(({ id, kind, date, completed, exercises }) => ({
        id, kind, date, completed,
        exerciseCount: exercises.length,
        completedCount: exercises.filter((exercise) => exercise.completed).length,
      })),
      nextPage: null,
    });
  }

  override getSession(sessionId: string) {
    return of([this.session, ...this.generatedSessions].find((s) => s.id === sessionId) ?? null);
  }

  override recordResult() {
    return of(undefined);
  }

  override getPreferences() {
    return of({ ...this.preferences });
  }

  override setPreferences() {
    return of(undefined);
  }

  override getStreak() {
    return of({ currentStreak: this.currentStreak, last7Days: [false, false, false, false, false, false, false] });
  }
}

describe('DailyPracticeHomeComponent', () => {
  let fixture: ComponentFixture<DailyPracticeHomeComponent>;
  let stub: StubPracticeService;

  beforeEach(() => {
    delete window.Telegram;
  });

  /**
   * The component's constructor fetches the session synchronously (the stub
   * emits via `of`), so `session`/`preferences` must be set on the stub
   * BEFORE `TestBed.createComponent` runs it — not after, via the returned
   * fixture's `componentInstance`/outer `stub` variable.
   */
  function create(
    overrides: {
      session?: DailyPracticeSession;
      preferences?: PracticePreferences;
      error?: boolean;
      currentStreak?: number;
      generatedSessions?: DailyPracticeSession[];
    } = {},
  ): ComponentFixture<DailyPracticeHomeComponent> {
    TestBed.configureTestingModule({
      imports: [DailyPracticeHomeComponent],
      providers: [provideRouter([]), { provide: PracticeService, useClass: StubPracticeService }],
    });
    stub = TestBed.inject(PracticeService) as unknown as StubPracticeService;
    if (overrides.session) stub.session = overrides.session;
    if (overrides.preferences) stub.preferences = overrides.preferences;
    if (overrides.error) stub.startTodaySessionError = true;
    if (overrides.currentStreak !== undefined) stub.currentStreak = overrides.currentStreak;
    if (overrides.generatedSessions) stub.generatedSessions = overrides.generatedSessions;
    fixture = TestBed.createComponent(DailyPracticeHomeComponent);
    return fixture;
  }

  it('shows the error state when the session fails to load, with a Try again action', () => {
    create({ error: true });
    fixture.detectChanges();

    expect(fixture.componentInstance.screen()).toBe('error');
    expect(fixture.nativeElement.textContent).toContain("Couldn't load today's practice");
  });

  it('shows the empty state with a Go to games action when there are no exercises', () => {
    create().detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No exercises yet');
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    (fixture.nativeElement.querySelector('.kz-home-primary') as HTMLButtonElement).click();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('shows Start practice with "Up next" on the first row for a brand-new session', () => {
    const session: DailyPracticeSession = {
      id: 'daily-1',
      kind: 'daily',
      date: '2026-01-01',
      completed: false,
      exercises: [exerciseRef({ id: 'e1' }), exerciseRef({ id: 'e2' }), exerciseRef({ id: 'e3' })],
    };
    create({ session });
    fixture.detectChanges();

    expect(fixture.componentInstance.primaryLabel()).toBe('Start practice');
    expect(fixture.componentInstance.rowStatus(session.exercises[0])).toBe('next');
    expect(fixture.componentInstance.rowStatus(session.exercises[1])).toBe('ahead');
    expect(fixture.nativeElement.textContent).toContain('3 exercises today');
  });

  it('shows "Community exercise" instead of a name for a dataset-origin row, never the raw opponentName', () => {
    const session: DailyPracticeSession = {
      id: 'daily-1',
      kind: 'daily',
      date: '2026-01-01',
      completed: false,
      exercises: [exerciseRef({ id: 'e1', origin: 'dataset', opponentName: 'Unknown opponent', opponentRank: '' })],
    };
    create({ session });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Community exercise');
    expect(fixture.nativeElement.textContent).not.toContain('Unknown opponent');
  });

  it('shows Continue practice once at least one exercise is solved, naming the right exercise row as Solved/next', () => {
    const session: DailyPracticeSession = {
      id: 'daily-1',
      kind: 'daily',
      date: '2026-01-01',
      completed: false,
      exercises: [
        exerciseRef({ id: 'e1', completed: true }),
        exerciseRef({ id: 'e2' }),
        exerciseRef({ id: 'e3' }),
      ],
    };
    create({ session });
    fixture.detectChanges();

    expect(fixture.componentInstance.primaryLabel()).toBe('Continue practice');
    expect(fixture.componentInstance.rowStatus(session.exercises[0])).toBe('solved');
    expect(fixture.componentInstance.rowStatus(session.exercises[1])).toBe('next');
    expect(fixture.nativeElement.textContent).toContain('Exercise 2 of 3');
  });

  it('shows Practice complete with Review exercises, no Start/Continue button, once every exercise is solved', () => {
    create({
      session: {
        id: 'daily-1',
        kind: 'daily',
        date: '2026-01-01',
        completed: true,
        exercises: [exerciseRef({ id: 'e1', completed: true })],
      },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Practice complete');
    expect(fixture.nativeElement.querySelector('.kz-home-primary')).toBeNull();

    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    (fixture.nativeElement.querySelector('.kz-home-review') as HTMLButtonElement).click();
    expect(router.navigate).toHaveBeenCalledWith(['/practice/session', 'daily-1'], { queryParams: { review: '1' } });
  });

  it('"More exercises" sits above "Review exercises", starts a fresh round, and jumps straight into it', () => {
    create({
      session: {
        id: 'daily-1',
        kind: 'daily',
        date: '2026-01-01',
        completed: true,
        exercises: [exerciseRef({ id: 'e1', completed: true })],
      },
    });
    fixture.detectChanges();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.kz-home-complete button')) as HTMLButtonElement[];
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['More exercises', 'Review exercises']);

    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    buttons[0].click();

    expect(stub.startNewRoundCalls).toBe(1);
    expect(router.navigate).toHaveBeenCalledWith(['/practice/session', 'daily-1'], { info: { startedSession: stub.session } });
  });

  it('keeps More exercises available after a failed request', () => {
    create({
      session: {
        id: 'daily-1', kind: 'daily', date: '2026-01-01', completed: true,
        exercises: [exerciseRef({ id: 'e1', completed: true })],
      },
    });
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    spyOn(console, 'error');
    const start = spyOn(stub, 'startNewRound').and.returnValue(throwError(() => new Error('network')));
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.kz-home-complete-continue');
    button.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Try again');
    expect(button.disabled).toBeFalse();
    expect(router.navigate).not.toHaveBeenCalled();

    const round: DailyPracticeSession = { ...stub.session, id: 'generated-1', kind: 'generated' };
    start.and.returnValue(of(round));
    button.click();
    expect(router.navigate).toHaveBeenCalledWith(['/practice/session', 'generated-1'], { info: { startedSession: round } });
  });

  it('shows the current preference values on the settings row and navigates to /practice/settings', () => {
    create({
      session: { id: 'daily-1', kind: 'daily', date: '2026-01-01', completed: false, exercises: [exerciseRef({ id: 'e1' })] },
      preferences: { topVariants: 3, continuationDepth: 4, exerciseSource: 'own' as const, exerciseCount: 5 },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Top 3 moves accepted · 4 moves deep');

    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    (fixture.nativeElement.querySelector('.kz-home-settings-row') as HTMLButtonElement).click();
    expect(router.navigate).toHaveBeenCalledWith(['/practice/settings']);
  });

  it('Start/Continue practice navigates to /practice/session/:id', () => {
    create({ session: { id: 'daily-1', kind: 'daily', date: '2026-01-01', completed: false, exercises: [exerciseRef({ id: 'e1' })] } });
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    (fixture.nativeElement.querySelector('.kz-home-primary') as HTMLButtonElement).click();
    expect(router.navigate).toHaveBeenCalledWith(['/practice/session', 'daily-1']);
  });

  it('tapping an exercise row opens that specific exercise directly, not just the first unsolved one', () => {
    create({
      session: {
        id: 'daily-1',
        kind: 'daily',
        date: '2026-01-01',
        completed: false,
        exercises: [exerciseRef({ id: 'e1' }), exerciseRef({ id: 'e2' }), exerciseRef({ id: 'e3' })],
      },
    });
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    const rows = fixture.nativeElement.querySelectorAll('.kz-home-row') as NodeListOf<HTMLButtonElement>;
    rows[2].click();
    expect(router.navigate).toHaveBeenCalledWith(['/practice/session', 'daily-1'], { queryParams: { exerciseId: 'e3' } });
  });

  it('"Random practice" sits below Start/Continue practice, opens the count dialog, and starting it from there jumps straight into the new session', () => {
    create({ session: { id: 'daily-1', kind: 'daily', date: '2026-01-01', completed: false, exercises: [exerciseRef({ id: 'e1' })] } });
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    (fixture.nativeElement.querySelector('.kz-home-random') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull(); // picking the count comes first, no call yet
    expect(stub.startRandomPracticeCalls).toBe(0);

    (fixture.nativeElement.querySelector('.kz-rpd-confirm') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(stub.startRandomPracticeCalls).toBe(1);
    expect(stub.startRandomPracticeCount).toBe(5); // the dialog's own default
    expect(router.navigate).toHaveBeenCalledWith(['/practice/session', 'random-1']);
  });

  it('lists other generated sessions separately, each opening its own id', () => {
    create({
      session: { id: 'daily-1', kind: 'daily', date: '2026-01-01', completed: false, exercises: [exerciseRef({ id: 'e1' })] },
      generatedSessions: [
        { id: 'random-1', kind: 'generated', date: '2026-01-01', completed: false, exercises: [exerciseRef({ id: 'r1' }), exerciseRef({ id: 'r2', completed: true })] },
      ],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Other sessions');
    expect(fixture.nativeElement.textContent).toContain('1 of 2 done');

    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    (fixture.nativeElement.querySelector('.kz-home-other-session-row') as HTMLButtonElement).click();
    expect(router.navigate).toHaveBeenCalledWith(['/practice/session', 'random-1']);
  });

  it('hides the streak badge at 0', () => {
    create({
      session: { id: 'daily-1', kind: 'daily', date: '2026-01-01', completed: false, exercises: [exerciseRef({ id: 'e1' })] },
      currentStreak: 0,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('kz-streak-badge')).toBeNull();
  });

  it('shows the streak badge next to the date once it is positive', () => {
    create({
      session: { id: 'daily-1', kind: 'daily', date: '2026-01-01', completed: false, exercises: [exerciseRef({ id: 'e1' })] },
      currentStreak: 4,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('kz-streak-badge')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('4 days in a row');
  });

  it('BackButton returns to Games', () => {
    create().detectChanges();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    fixture.componentInstance.backToGames();

    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('shows the Telegram BackButton on load and hides it on destroy', () => {
    TestBed.configureTestingModule({
      imports: [DailyPracticeHomeComponent],
      providers: [provideRouter([]), { provide: PracticeService, useClass: StubPracticeService }],
    });
    const telegram = TestBed.inject(TelegramService);
    spyOn(telegram, 'showBackButton');
    spyOn(telegram, 'hideBackButton');

    fixture = TestBed.createComponent(DailyPracticeHomeComponent);
    fixture.detectChanges();
    expect(telegram.showBackButton).toHaveBeenCalled();

    fixture.destroy();
    expect(telegram.hideBackButton).toHaveBeenCalled();
  });
});
