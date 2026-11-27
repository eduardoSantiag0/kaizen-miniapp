import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MockPracticeService } from './mock-practice.service';
import { GameHistoryService } from './game-history.service';
import { SgfParserService } from '../sgf/sgf-parser.service';
import type { GameHistoryDto } from './game-history.model';

const EXERCISE_SGF = '(;FF[4]SZ[9]AB[cc]PL[B](;B[ec];W[fc])(;B[gc]))';
const NO_BRANCH_SGF = '(;FF[4]SZ[9]AB[cc]PL[B];B[ec];W[fc])';

function dto(overrides: Partial<GameHistoryDto> = {}): GameHistoryDto {
  return {
    id: 'g1',
    correlationId: 'c1',
    openingAnalysed: null,
    middlegameAnalysed: null,
    endgameAnalysed: null,
    blackPlayer: null,
    whitePlayer: null,
    gameRank: null,
    ...overrides,
  };
}

class StubGameHistoryService extends GameHistoryService {
  dtos: GameHistoryDto[] = [];

  override listGames() {
    return of(this.dtos);
  }

  override getGameHistory(gameId: string) {
    return of(this.dtos.find((d) => d.id === gameId)!);
  }

  override resignGame() {
    return of(undefined);
  }
}

describe('MockPracticeService', () => {
  let service: MockPracticeService;
  let stubHistory: StubGameHistoryService;

  beforeEach(() => {
    localStorage.clear(); // sessions persist here — isolate each test

    TestBed.configureTestingModule({
      providers: [
        MockPracticeService,
        SgfParserService,
        { provide: GameHistoryService, useClass: StubGameHistoryService },
      ],
    });
    service = TestBed.inject(MockPracticeService);
    stubHistory = TestBed.inject(GameHistoryService) as unknown as StubGameHistoryService;
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('has no session before starting', (done) => {
    service.getTodaySession().subscribe((session) => {
      expect(session).toBeNull();
      done();
    });
  });

  it('picks up to 5 exercise-able phases across games, skipping unreadable ones', (done) => {
    stubHistory.dtos = [
      dto({ id: 'g1', openingAnalysed: EXERCISE_SGF, middlegameAnalysed: NO_BRANCH_SGF }),
      dto({ id: 'g2', endgameAnalysed: EXERCISE_SGF }),
    ];

    service.startTodaySession().subscribe((session) => {
      expect(session.exercises.length).toBe(2); // g1-opening, g2-endgame — middlegame has no branch point
      expect(session.exercises.map((e) => e.gameId)).toEqual(['g1', 'g2']);
      expect(session.exercises.every((e) => e.origin === 'personal')).toBe(true); // the chat's own games, never the pool
      expect(session.kind).toBe('daily');
      expect(session.completed).toBe(false);
      done();
    });
  });

  it('starting twice returns the same session (idempotent), same id', (done) => {
    stubHistory.dtos = [dto({ id: 'g1', openingAnalysed: EXERCISE_SGF })];

    service.startTodaySession().subscribe((first) => {
      service.startTodaySession().subscribe((second) => {
        expect(second).toEqual(first);
        done();
      });
    });
  });

  it('recording every exercise\'s result marks the session completed', (done) => {
    stubHistory.dtos = [dto({ id: 'g1', openingAnalysed: EXERCISE_SGF })];

    service.startTodaySession().subscribe((session) => {
      const exerciseId = session.exercises[0].id;

      service.recordResult(session.id, exerciseId).subscribe(() => {
        service.getTodaySession().subscribe((updated) => {
          expect(updated!.exercises[0].completed).toBe(true);
          expect(updated!.completed).toBe(true);
          done();
        });
      });
    });
  });

  it('preferences default to topVariants 3 / continuationDepth 4 / exerciseSource own, and can be changed', (done) => {
    service.getPreferences().subscribe((defaults) => {
      expect(defaults).toEqual({ topVariants: 3, continuationDepth: 4, exerciseSource: 'own' as const, exerciseCount: 5 });

      service.setPreferences({ topVariants: 1, continuationDepth: 2, exerciseSource: 'own' as const, exerciseCount: 5 }).subscribe(() => {
        service.getPreferences().subscribe((updated) => {
          expect(updated).toEqual({ topVariants: 1, continuationDepth: 2, exerciseSource: 'own' as const, exerciseCount: 5 });
          done();
        });
      });
    });
  });

  it('startNewRound always regenerates, unlike startTodaySession, uncompleted and still against the chat\'s own games — a new generated session, never touching the daily one', (done) => {
    stubHistory.dtos = [dto({ id: 'g1', openingAnalysed: EXERCISE_SGF })];

    service.startTodaySession().subscribe((first) => {
      service.recordResult(first.id, first.exercises[0].id).subscribe(() => {
        service.startNewRound().subscribe((round) => {
          expect(round.id).not.toBe(first.id); // never overwrites the daily session — must not affect the streak
          expect(round.kind).toBe('generated');
          expect(round.exercises.length).toBe(1);
          expect(round.exercises[0].completed).toBe(false); // fresh, not the just-completed one replayed
          expect(round.completed).toBe(false);

          service.getTodaySession().subscribe((daily) => {
            expect(daily!.completed).toBe(true); // the streak-earning daily session is untouched
            done();
          });
        });
      });
    });
  });

  it('"mixed" exerciseSource behaves like "own" in the mock — there is no local stand-in for the real backend\'s shared public pool', (done) => {
    stubHistory.dtos = [dto({ id: 'g1', openingAnalysed: EXERCISE_SGF })];

    service.setPreferences({ topVariants: 3, continuationDepth: 4, exerciseSource: 'mixed', exerciseCount: 5 }).subscribe(() => {
      service.startTodaySession().subscribe((session) => {
        expect(session.exercises.length).toBe(1);
        expect(session.exercises[0].gameId).toBe('g1');
        expect(session.exercises[0].origin).toBe('personal');
        done();
      });
    });
  });

  it('startRandomPractice draws from the chat\'s own (real + synthetic) games, tagged "personal" — no distinct pool exists in the mock, see HttpPracticeService for the real integration', (done) => {
    stubHistory.dtos = [
      dto({ id: 'g1', openingAnalysed: EXERCISE_SGF }),
      dto({ id: 'g2', openingAnalysed: EXERCISE_SGF }),
    ];

    service.startRandomPractice(2).subscribe((session) => {
      expect(session.kind).toBe('generated');
      expect(session.exercises.length).toBe(2);
      expect(session.exercises.every((e) => e.origin === 'personal')).toBe(true);
      done();
    });
  });

  it('honors the exerciseCount preference when capping the daily session', (done) => {
    stubHistory.dtos = [
      dto({ id: 'g1', openingAnalysed: EXERCISE_SGF, middlegameAnalysed: EXERCISE_SGF, endgameAnalysed: EXERCISE_SGF }),
    ];

    service.setPreferences({ topVariants: 3, continuationDepth: 4, exerciseSource: 'own', exerciseCount: 2 }).subscribe(() => {
      service.startTodaySession().subscribe((session) => {
        expect(session.exercises.length).toBe(2); // capped at 2, even though 3 phases are exercise-able
        done();
      });
    });
  });

  it('startRandomPractice stays capped at the requested count even against many candidates (100 games), independent of the exerciseCount preference', (done) => {
    stubHistory.dtos = Array.from({ length: 100 }, (_, i) => dto({ id: `g-${i}`, openingAnalysed: EXERCISE_SGF }));

    service.setPreferences({ topVariants: 3, continuationDepth: 4, exerciseSource: 'own', exerciseCount: 2 }).subscribe(() => {
      service.startRandomPractice(7).subscribe((session) => {
        expect(session.exercises.length).toBe(7); // the dialog's own count, not the exerciseCount preference (2)
        done();
      });
    });
  });

  it('startRandomPractice never replaces the daily session or a previous generated one — every call adds a new session', (done) => {
    stubHistory.dtos = [
      dto({ id: 'g1', openingAnalysed: EXERCISE_SGF }),
      dto({ id: 'g2', openingAnalysed: EXERCISE_SGF }),
    ];

    service.startTodaySession().subscribe((daily) => {
      service.startRandomPractice(1).subscribe((firstRound) => {
        service.startRandomPractice(1).subscribe((secondRound) => {
          expect(firstRound.id).not.toBe(secondRound.id);
          expect(firstRound.id).not.toBe(daily.id);

          service.listSessions().subscribe((all) => {
            expect(all.map((s) => s.id).sort()).toEqual([daily.id, firstRound.id, secondRound.id].sort());
            expect(all.filter((s) => s.kind === 'daily').length).toBe(1);
            expect(all.filter((s) => s.kind === 'generated').length).toBe(2);
            done();
          });
        });
      });
    });
  });

  it('getSession returns a specific session by id, daily or generated, and null for an unknown id', (done) => {
    stubHistory.dtos = [dto({ id: 'g1', openingAnalysed: EXERCISE_SGF })];

    service.startTodaySession().subscribe((daily) => {
      service.getSession(daily.id).subscribe((found) => {
        expect(found?.id).toBe(daily.id);

        service.getSession('does-not-exist').subscribe((missing) => {
          expect(missing).toBeNull();
          done();
        });
      });
    });
  });

  function isoDaysAgo(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function seedDailySession(daysAgo: number, completed: boolean): void {
    const raw = localStorage.getItem('kz-practice-sessions');
    const sessions = raw ? JSON.parse(raw) : [];
    // A non-empty exercises array — an actually-practiced day, not the
    // trivially-"completed" 0-exercise case getStreak must ignore.
    sessions.push({ id: `seed-${daysAgo}`, kind: 'daily', date: isoDaysAgo(daysAgo), exercises: [{ id: 'e1', completed }], completed });
    localStorage.setItem('kz-practice-sessions', JSON.stringify(sessions));
  }

  describe('getStreak', () => {
    it('is 0/all-false with no history at all', (done) => {
      service.getStreak().subscribe((streak) => {
        expect(streak.currentStreak).toBe(0);
        expect(streak.last7Days).toEqual([false, false, false, false, false, false, false]);
        done();
      });
    });

    it('counts consecutive completed days ending today', (done) => {
      seedDailySession(2, true);
      seedDailySession(1, true);
      seedDailySession(0, true);
      const reloaded = TestBed.runInInjectionContext(() => new MockPracticeService());

      reloaded.getStreak().subscribe((streak) => {
        expect(streak.currentStreak).toBe(3);
        expect(streak.last7Days).toEqual([false, false, false, false, true, true, true]);
        done();
      });
    });

    it("does not reset while today just isn't finished yet — counts the run ending yesterday instead", (done) => {
      seedDailySession(2, true);
      seedDailySession(1, true);
      // today: no daily session yet at all
      const reloaded = TestBed.runInInjectionContext(() => new MockPracticeService());

      reloaded.getStreak().subscribe((streak) => {
        expect(streak.currentStreak).toBe(2);
        done();
      });
    });

    it('stops counting at the first gap, even if older days were completed', (done) => {
      seedDailySession(3, true);
      // daysAgo 2 missing — breaks the chain
      seedDailySession(1, true);
      seedDailySession(0, true);
      const reloaded = TestBed.runInInjectionContext(() => new MockPracticeService());

      reloaded.getStreak().subscribe((streak) => {
        expect(streak.currentStreak).toBe(2); // just today + yesterday
        done();
      });
    });

    it('an unfinished daily session does not count as done, breaking the chain', (done) => {
      seedDailySession(1, false);
      seedDailySession(0, true);
      const reloaded = TestBed.runInInjectionContext(() => new MockPracticeService());

      reloaded.getStreak().subscribe((streak) => {
        expect(streak.currentStreak).toBe(1); // yesterday wasn't actually finished
        done();
      });
    });

    it('a day with no analyzed games (0-exercise daily session, trivially "completed") does not count as practiced', (done) => {
      service.startTodaySession().subscribe(() => {
        // No games at all today — startTodaySession() still marks it completed (nothing to finish).
        service.getStreak().subscribe((streak) => {
          expect(streak.currentStreak).toBe(0);
          expect(streak.last7Days[6]).toBe(false);
          done();
        });
      });
    });

    it('a "generated" (Random practice) session on the same date never counts towards the streak', (done) => {
      stubHistory.dtos = [dto({ id: 'g1', openingAnalysed: EXERCISE_SGF })];

      service.startRandomPractice(1).subscribe((round) => {
        service.recordResult(round.id, round.exercises[0].id).subscribe(() => {
          service.getStreak().subscribe((streak) => {
            expect(streak.currentStreak).toBe(0); // only a 'daily' session should ever count
            done();
          });
        });
      });
    });
  });

  it('sessions persist to localStorage, so a brand new service instance (simulating a reload) still finds them', (done) => {
    stubHistory.dtos = [dto({ id: 'g1', openingAnalysed: EXERCISE_SGF })];

    service.startTodaySession().subscribe((daily) => {
      // A second, independently-constructed instance (not TestBed's cached singleton) against the same localStorage.
      const reloaded = TestBed.runInInjectionContext(() => new MockPracticeService());

      reloaded.getSession(daily.id).subscribe((found) => {
        expect(found?.id).toBe(daily.id);
        expect(found?.exercises.length).toBe(daily.exercises.length);
        done();
      });
    });
  });
});
