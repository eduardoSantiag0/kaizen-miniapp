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

  it('preferences default to topVariants 3 / continuationDepth 4, and can be changed', (done) => {
    service.getPreferences().subscribe((defaults) => {
      expect(defaults).toEqual({ topVariants: 3, continuationDepth: 4 });

      service.setPreferences({ topVariants: 1, continuationDepth: 2 }).subscribe(() => {
        service.getPreferences().subscribe((updated) => {
          expect(updated).toEqual({ topVariants: 1, continuationDepth: 2 });
          done();
        });
      });
    });
  });
});
