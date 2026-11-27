import { HttpErrorResponse } from '@angular/common/http';
﻿import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { delay, throwError, of } from 'rxjs';
import { PracticeSessionComponent } from './practice-session.component';
import { PracticeService } from '../data/practice.service';
import type { DailyPracticeSession, PracticeExerciseRef, PracticePreferences } from '../data/practice.model';
import type { ExerciseProgress } from '../exercise/exercise-state';
import { readPracticeLocal, readPracticePosition, writePracticeLocal } from '../data/practice-local';
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
    origin: 'personal',
    // ExercisePageComponent's daily mode now builds straight off this, never via GameHistoryService —
    // matches StubGameHistoryService's own g1/g2 dtos so either path would agree, were it still used.
    sgf: overrides.gameId === 'g2' ? SGF_B : SGF_A,
    opponentName: 'kitsune77',
    opponentRank: '4k',
    boardSize: 9,
    userSign: 1,
    moveNumber: 1,
    topVariants: 3,
    requiredDepth: 4,
    ...overrides,
  };
}

class StubPracticeService extends PracticeService {
  session: DailyPracticeSession = { id: 's1', kind: 'daily', date: '2026-01-01', exercises: [], completed: false };
  preferences: PracticePreferences = { topVariants: 3, continuationDepth: 4, exerciseSource: 'own' as const, exerciseCount: 5 };
  recordedResults: { sessionId: string; id: string }[] = [];

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

  override listSessions() {
    return of({ sessions: [], nextPage: null });
  }

  override getSession(sessionId: string) {
    return of(this.session.id === sessionId ? this.session : null);
  }

  override recordResult(sessionId: string, exerciseId: string) {
    this.recordedResults.push({ sessionId, id: exerciseId });
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

  function create(session: DailyPracticeSession, review = false, exerciseId?: string): ComponentFixture<PracticeSessionComponent> {
    const queryParams: Record<string, string> = {};
    if (review) queryParams['review'] = '1';
    if (exerciseId) queryParams['exerciseId'] = exerciseId;

    TestBed.configureTestingModule({
      imports: [PracticeSessionComponent],
      providers: [
        provideRouter([]),
        { provide: PracticeService, useClass: StubPracticeService },
        { provide: GameHistoryService, useClass: StubGameHistoryService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } },
        },
      ],
    });
    stub = TestBed.inject(PracticeService) as unknown as StubPracticeService;
    stub.session = session;
    fixture = TestBed.createComponent(PracticeSessionComponent);
    fixture.componentRef.setInput('id', session.id);
    return fixture;
  }

  it('opens the exercise named by the exerciseId query param, overriding "first unsolved" — Daily Practice Home\'s click-a-row path', fakeAsync(() => {
    create(
      {
        id: 's1',
        kind: 'daily',
        date: '2026-01-01',
        completed: false,
        exercises: [exerciseRef({ id: 'e1', gameId: 'g1' }), exerciseRef({ id: 'e2', gameId: 'g2' })],
      },
      false,
      'e2',
    );
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(fixture.componentInstance.currentExercise()?.id).toBe('e2');
  }));

  it('opens the first unsolved exercise, not the first in session order', fakeAsync(() => {
    create({
      id: 's1',
      kind: 'daily',
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
        id: 's1',
        kind: 'daily',
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

  it('records the result through PracticeService (with this session\'s own id) when a fresh exercise is solved', fakeAsync(() => {
    create({
      id: 's1',
      kind: 'daily',
      date: '2026-01-01',
      completed: false,
      exercises: [exerciseRef({ id: 'e1', gameId: 'g1' })],
    });
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    fixture.componentInstance.onExerciseSolved();

    expect(stub.recordedResults).toEqual([{ sessionId: 's1', id: 'e1' }]);
  }));

  it('never re-records a result for an already-completed exercise (review mode)', fakeAsync(() => {
    create(
      {
        id: 's1',
        kind: 'daily',
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

  it('onDailyNext advances to the next exercise, and opens the completion screen on the last one (daily session)', fakeAsync(() => {
    create({
      id: 's1',
      kind: 'daily',
      date: '2026-01-01',
      completed: false,
      exercises: [exerciseRef({ id: 'e1', gameId: 'g1' }), exerciseRef({ id: 'e2', gameId: 'g2' })],
    });
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(fixture.componentInstance.currentExercise()?.id).toBe('e1');
    expect(fixture.componentInstance.isLastExercise()).toBe(false);

    fixture.componentInstance.onExerciseSolved();
    fixture.componentInstance.onDailyNext();
    expect(fixture.componentInstance.currentExercise()?.id).toBe('e2');
    expect(fixture.componentInstance.isLastExercise()).toBe(true);

    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    fixture.componentInstance.onExerciseSolved();
    fixture.componentInstance.onDailyNext();
    expect(router.navigate).not.toHaveBeenCalled();
    tick(450); // FINISH_PRACTICE_DELAY_MS — the finished board stays on screen a beat before navigating.
    expect(router.navigate).toHaveBeenCalledWith(['/practice/complete']);
  }));

  it('onDailyNext waits past the visual delay for a slow recordResult, instead of racing /practice/complete against it', fakeAsync(() => {
    create({
      id: 's1',
      kind: 'daily',
      date: '2026-01-01',
      completed: false,
      exercises: [exerciseRef({ id: 'e1', gameId: 'g1' })],
    });
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    // Slower than FINISH_PRACTICE_DELAY_MS — without waiting on it, Finish practice would
    // navigate to /practice/complete before the backend had recorded this exercise as done.
    spyOn(stub, 'recordResult').and.returnValue(of(undefined).pipe(delay(1000)));
    fixture.componentInstance.onExerciseSolved();

    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    fixture.componentInstance.onDailyNext();

    tick(450);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.finishedLocally()).toBeTrue();
    tick(550);
    expect(fixture.componentInstance.completionStatus()).toBe('confirmed');
    expect(router.navigate).not.toHaveBeenCalled();
    tick(450);
    expect(router.navigate).toHaveBeenCalledWith(['/practice/complete']);
  }));

  it('advances with a pending result and clears that result after retry', fakeAsync(() => {
    create({
      id: 'retry-session',
      kind: 'daily',
      date: '2026-01-01',
      completed: false,
      exercises: [exerciseRef({ id: 'e1', gameId: 'g1' }), exerciseRef({ id: 'e2', gameId: 'g2' })],
    });
    fixture.detectChanges();
    tick();

    const record = spyOn(stub, 'recordResult').and.returnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    spyOn(console, 'error');
    fixture.componentInstance.onExerciseSolved();
    tick(1000);
    expect(fixture.componentInstance.completionStatus()).toBe('pending_sync');
    expect(readPracticeLocal('standalone', 'retry-session', 'e1', 'result')).toBe('pending');
    fixture.componentInstance.onDailyNext();
    expect(fixture.componentInstance.currentExercise()?.id).toBe('e2');
    expect(fixture.componentInstance.pendingExerciseNumbers()).toBe('1');

    record.and.returnValue(of(undefined));
    fixture.componentInstance.retrySync();
    expect(fixture.componentInstance.pendingExerciseNumbers()).toBe('');
    expect(readPracticeLocal('standalone', 'retry-session', 'e1', 'result')).toBeNull();
  }));

  it('keeps the newer session when an earlier request responds late', fakeAsync(() => {
    const first: DailyPracticeSession = {
      id: 'slow-session', kind: 'daily', date: '2026-01-01', completed: false,
      exercises: [exerciseRef({ id: 'e1', gameId: 'g1' })],
    };
    const next: DailyPracticeSession = {
      ...first, id: 'new-session', exercises: [exerciseRef({ id: 'e2', gameId: 'g2' })],
    };
    create(first);
    spyOn(stub, 'getSession').and.callFake((id) =>
      id === first.id ? of(first).pipe(delay(500)) : of(next),
    );
    fixture.detectChanges();
    fixture.componentRef.setInput('id', next.id);
    fixture.detectChanges();
    tick(500);

    expect(fixture.componentInstance.currentExercise()?.id).toBe('e2');
  }));

  it('keeps unauthorized results pending for a fresh session to retry', fakeAsync(() => {
    create({
      id: 'expired-auth', kind: 'daily', date: '2026-01-01', completed: false,
      exercises: [exerciseRef({ id: 'e1', gameId: 'g1' })],
    });
    fixture.detectChanges();
    const record = spyOn(stub, 'recordResult').and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 401 })),
    );
    spyOn(console, 'error');
    fixture.componentInstance.onExerciseSolved();
    tick(2000);

    expect(record).toHaveBeenCalledTimes(1);
    expect(readPracticeLocal('standalone', 'expired-auth', 'e1', 'result')).toBe('pending');
    expect(fixture.componentInstance.rejectedExerciseNumbers()).toBe('');

    record.and.returnValue(of(undefined));
    fixture.componentInstance.retrySync();
    expect(readPracticeLocal('standalone', 'expired-auth', 'e1', 'result')).toBeNull();
  }));

  it('does not retry a definitive result rejection or open the completion screen', fakeAsync(() => {
    create({
      id: 'rejected-session',
      kind: 'daily',
      date: '2026-01-01',
      completed: false,
      exercises: [exerciseRef({ id: 'e1', gameId: 'g1' })],
    });
    fixture.detectChanges();
    tick();

    let attempts = 0;
    spyOn(stub, 'recordResult').and.returnValue(throwError(() => {
      attempts++;
      return new HttpErrorResponse({ status: 400 });
    }));
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    spyOn(console, 'error');

    fixture.componentInstance.onExerciseSolved();
    fixture.componentInstance.retrySync();
    fixture.componentInstance.onDailyNext();
    tick(16000);

    expect(attempts).toBe(1);
    expect(fixture.componentInstance.rejectedExerciseNumbers()).toBe('1');
    expect(router.navigate).not.toHaveBeenCalled();
    writePracticeLocal('standalone', 'rejected-session', 'e1', 'result', null);
  }));

  it('resumes an expanded exercise even when its original result is already confirmed', fakeAsync(() => {
    const progress: ExerciseProgress = {
      selectedVariant: 0, confirmedPlies: 2, progressPhase: 'playing', deepening: true, currentDepth: 6,
    };
    writePracticeLocal('standalone', 'deeper-session', 'e1', 'position', progress);
    create({
      id: 'deeper-session',
      kind: 'daily',
      date: '2026-01-01',
      completed: false,
      exercises: [
        exerciseRef({ id: 'e1', gameId: 'g1', completed: true }),
        exerciseRef({ id: 'e2', gameId: 'g2' }),
      ],
    });
    fixture.detectChanges();
    tick();

    expect(fixture.componentInstance.currentExercise()?.id).toBe('e1');
    expect(fixture.componentInstance.completionStatus()).toBe('confirmed');
    expect(stub.recordedResults).toEqual([]);
    expect(fixture.componentInstance.currentProgress()).toEqual(progress);
    writePracticeLocal('standalone', 'deeper-session', 'e1', 'position', null);
  }));

  it('onDailyNext on the last exercise of a generated session returns to the session list, not the completion screen', fakeAsync(() => {
    create({
      id: 'random-1',
      kind: 'generated',
      date: '2026-01-01',
      completed: false,
      exercises: [exerciseRef({ id: 'e1', gameId: 'g1' })],
    });
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    fixture.componentInstance.onExerciseSolved();
    fixture.componentInstance.onDailyNext();
    expect(router.navigate).toHaveBeenCalledWith(['/practice']);
  }));

  it('a generated session shows its own on-screen back button (no Telegram chrome to rely on), a daily session does not', fakeAsync(() => {
    create({
      id: 'random-1',
      kind: 'generated',
      date: '2026-01-01',
      completed: false,
      exercises: [exerciseRef({ id: 'e1', gameId: 'g1' })],
    });
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    const back = fixture.nativeElement.querySelector('.kz-session-back') as HTMLButtonElement;
    expect(back).not.toBeNull();
    back.click();
    expect(router.navigate).toHaveBeenCalledWith(['/practice']);
  }));

  it('a daily session has no on-screen back button — Telegram\'s native BackButton is the only way back', fakeAsync(() => {
    create({
      id: 's1',
      kind: 'daily',
      date: '2026-01-01',
      completed: false,
      exercises: [exerciseRef({ id: 'e1', gameId: 'g1' })],
    });
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.kz-session-back')).toBeNull();
  }));

  it('stores the position locally and restores it when the session is reopened', fakeAsync(() => {
    const sessionId = 'persisted-session';
    const progress: ExerciseProgress = {
      selectedVariant: 0, confirmedPlies: 2, progressPhase: 'playing', deepening: false, currentDepth: 4,
    };
    create({
      id: sessionId,
      kind: 'daily',
      date: '2026-01-01',
      completed: false,
      exercises: [exerciseRef({ id: 'e1', gameId: 'g1' })],
    });
    fixture.detectChanges();
    tick();

    fixture.componentInstance.onProgressChanged(progress);
    expect(stub.recordedResults).toEqual([]);
    expect(readPracticePosition('standalone', sessionId, 'e1')).toEqual(progress);
    fixture.componentInstance.retry();
    tick();
    expect(fixture.componentInstance.currentProgress()).toEqual(progress);
    writePracticeLocal('standalone', sessionId, 'e1', 'position', null);
  }));

  it('isolates local positions and pending results by account, session and exercise', () => {
    const progress: ExerciseProgress = {
      selectedVariant: 0, confirmedPlies: 2, progressPhase: 'playing', deepening: false, currentDepth: 4,
    };
    writePracticeLocal('101', 's1', 'e1', 'position', progress);
    writePracticeLocal('101', 's1', 'e1', 'result', 'pending');
    expect(readPracticePosition('101', 's1', 'e1')).toEqual(progress);
    expect(readPracticePosition('102', 's1', 'e1')).toBeNull();
    expect(readPracticePosition('101', 's2', 'e1')).toBeNull();
    expect(readPracticePosition('101', 's1', 'e2')).toBeNull();
    expect(readPracticeLocal('102', 's1', 'e1', 'result')).toBeNull();
    writePracticeLocal('101', 's1', 'e1', 'position', null);
    writePracticeLocal('101', 's1', 'e1', 'result', null);
  });

  it('renders the exercise-page for the current exercise, with Telegram back returning to /practice (daily mode)', fakeAsync(() => {
    create({ id: 's1', kind: 'daily', date: '2026-01-01', completed: false, exercises: [exerciseRef({ id: 'e1', gameId: 'g1' })] });
    const telegram = TestBed.inject(TelegramService);
    spyOn(telegram, 'showBackButton');
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('kz-exercise-page')).not.toBeNull();
    expect(telegram.showBackButton).toHaveBeenCalled();
  }));
});
