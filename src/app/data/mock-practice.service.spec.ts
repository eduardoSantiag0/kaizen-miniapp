import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
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
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MockPracticeService,
        SgfParserService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: GameHistoryService, useClass: StubGameHistoryService },
      ],
    });
    service = TestBed.inject(MockPracticeService);
    stubHistory = TestBed.inject(GameHistoryService) as unknown as StubGameHistoryService;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

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
      expect(session.completed).toBe(false);
      done();
    });
  });

  it('starting twice returns the same session (idempotent)', (done) => {
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

      service.recordResult(exerciseId).subscribe(() => {
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

  it('startNewRound always regenerates, unlike startTodaySession, uncompleted and still against the chat\'s own games', (done) => {
    stubHistory.dtos = [dto({ id: 'g1', openingAnalysed: EXERCISE_SGF })];

    service.startTodaySession().subscribe((first) => {
      service.recordResult(first.exercises[0].id).subscribe(() => {
        service.startNewRound().subscribe((round) => {
          expect(round.exercises.length).toBe(1);
          expect(round.exercises[0].completed).toBe(false); // fresh, not the just-completed one replayed
          expect(round.completed).toBe(false);
          done();
        });
      });
    });
  });

  it('"own" exerciseSource never fetches the community pool', (done) => {
    stubHistory.dtos = [dto({ id: 'g1', openingAnalysed: EXERCISE_SGF })];

    service.startTodaySession().subscribe((session) => {
      expect(session.exercises.length).toBe(1);
      httpMock.expectNone('practice-pool/practice-pool.json');
      done();
    });
  });

  it('"mixed" exerciseSource pads a thin own-games session with the community pool, own games first', (done) => {
    stubHistory.dtos = [dto({ id: 'g1', openingAnalysed: EXERCISE_SGF })]; // only 1 exercise-able phase, well under the 5-exercise cap

    service.setPreferences({ topVariants: 3, continuationDepth: 4, exerciseSource: 'mixed', exerciseCount: 5 }).subscribe(() => {
      service.startTodaySession().subscribe((session) => {
        expect(session.exercises.length).toBe(5); // capped — the pool had one spare candidate past the cap
        expect(session.exercises[0].gameId).toBe('g1');
        expect(session.exercises.slice(1).map((e) => e.gameId)).toEqual(['pool-1', 'pool-2', 'pool-3', 'pool-4']);
        done();
      });

      httpMock.expectOne('practice-pool/practice-pool.json').flush([
        dto({ id: 'pool-1', openingAnalysed: EXERCISE_SGF }),
        dto({ id: 'pool-2', openingAnalysed: EXERCISE_SGF }),
        dto({ id: 'pool-3', openingAnalysed: EXERCISE_SGF }),
        dto({ id: 'pool-4', openingAnalysed: EXERCISE_SGF }),
        dto({ id: 'pool-5', openingAnalysed: EXERCISE_SGF }),
      ]);
    });
  });

  it('"mixed" exerciseSource degrades to "own" if the community pool fails to load', (done) => {
    stubHistory.dtos = [dto({ id: 'g1', openingAnalysed: EXERCISE_SGF })];

    service.setPreferences({ topVariants: 3, continuationDepth: 4, exerciseSource: 'mixed', exerciseCount: 5 }).subscribe(() => {
      service.startTodaySession().subscribe((session) => {
        expect(session.exercises.length).toBe(1);
        expect(session.exercises[0].gameId).toBe('g1');
        done();
      });

      httpMock.expectOne('practice-pool/practice-pool.json').flush('broken', { status: 500, statusText: 'Server Error' });
    });
  });

  it('startRandomPractice builds a session from the practice-pool alone, ignoring the chat\'s own games and the exerciseSource preference', (done) => {
    stubHistory.dtos = [dto({ id: 'g1', openingAnalysed: EXERCISE_SGF })]; // 'own' is the default — would normally be the only source

    service.startRandomPractice().subscribe((session) => {
      expect(session.exercises.length).toBe(2);
      expect(session.exercises.map((e) => e.gameId).sort()).toEqual(['pool-1', 'pool-2']);
      done();
    });

    httpMock.expectOne('practice-pool/practice-pool.json').flush([
      dto({ id: 'pool-1', openingAnalysed: EXERCISE_SGF }),
      dto({ id: 'pool-2', openingAnalysed: EXERCISE_SGF }),
    ]);
  });

  it('honors the exerciseCount preference when capping a session, for both the chat\'s own games and startRandomPractice', (done) => {
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
});
