import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { MockGameHistoryService } from './mock-game-history.service';

describe('MockGameHistoryService', () => {
  let service: MockGameHistoryService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MockGameHistoryService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MockGameHistoryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  /** getGameHistory checks the bundled practice-pool first (see PracticePoolService) — flush it empty so the real fixture fetch underneath is reached, same as every pre-pool test here expected. */
  function flushEmptyPool(): void {
    httpMock.expectOne('practice-pool/practice-pool.json').flush([]);
  }

  it('fetches all three phase SGFs and maps them onto a GameHistoryDto, ignoring the gameId', (done) => {
    service.getGameHistory('whatever-id').subscribe((dto) => {
      expect(dto.id).toBe('whatever-id');
      expect(dto.correlationId).toBeTruthy();
      expect(dto.openingAnalysed).toBe('OPENING SGF TEXT');
      expect(dto.middlegameAnalysed).toBe('MIDDLEGAME SGF TEXT');
      expect(dto.endgameAnalysed).toBe('ENDGAME SGF TEXT');
      done();
    });

    flushEmptyPool();

    const requests = httpMock.match(() => true);
    expect(requests.length).toBe(3);

    for (const req of requests) {
      expect(req.request.method).toBe('GET');
      if (req.request.url.includes('OPENING')) req.flush('OPENING SGF TEXT');
      else if (req.request.url.includes('MIDDLEGAME')) req.flush('MIDDLEGAME SGF TEXT');
      else if (req.request.url.includes('ENDGAME')) req.flush('ENDGAME SGF TEXT');
    }
  });

  it("resolves a practice-pool entry's gameId directly, without fetching the real fixture triplet", (done) => {
    service.getGameHistory('pool-7').subscribe((dto) => {
      expect(dto.id).toBe('pool-7');
      expect(dto.openingAnalysed).toBe('POOL SGF TEXT');
      done();
    });

    httpMock.expectOne('practice-pool/practice-pool.json').flush([
      {
        id: 'pool-7',
        correlationId: 'pool-7',
        openingAnalysed: 'POOL SGF TEXT',
        middlegameAnalysed: null,
        endgameAnalysed: null,
        blackPlayer: null,
        whitePlayer: null,
        gameRank: null,
      },
    ]);

    httpMock.expectNone(() => true); // no fixture fetch once the pool already answered
  });

  it('derives blackPlayer/whitePlayer/gameRank from the opening phase\'s PB/PW/BR/WR tags (mirrors AnalysisAggregator.setPlayersInfo)', (done) => {
    service.getGameHistory('g1').subscribe((dto) => {
      expect(dto.blackPlayer).toBe('gakutakunoku');
      expect(dto.whitePlayer).toBe('mekriff');
      expect(dto.gameRank).toBe('5k/2k');
      done();
    });

    flushEmptyPool();

    for (const req of httpMock.match(() => true)) {
      if (req.request.url.includes('OPENING')) {
        req.flush('(;FF[4]SZ[19]PB[gakutakunoku]BR[5k]PW[mekriff]WR[2k];B[pd])');
      } else {
        req.flush('(;FF[4]SZ[19])');
      }
    }
  });

  it('listGames returns the real fetched game plus the synthetic running/waiting rows', (done) => {
    service.listGames().subscribe((dtos) => {
      expect(dtos.length).toBe(4);
      expect(dtos[0].id).toBe('mock-game');
      expect(dtos.map((d) => d.id)).toContain('mock-game-running-today');
      expect(dtos.map((d) => d.id)).toContain('mock-game-running-dgs');
      expect(dtos.map((d) => d.id)).toContain('mock-game-clean');
      done();
    });

    for (const req of httpMock.match(() => true)) {
      req.flush('(;FF[4]SZ[19])');
    }
  });

  it('resignGame removes the game from every subsequent listGames call', (done) => {
    service.resignGame('mock-game-clean').subscribe(() => {
      service.listGames().subscribe((dtos) => {
        expect(dtos.map((d) => d.id)).not.toContain('mock-game-clean');
        done();
      });
      for (const req of httpMock.match(() => true)) {
        req.flush('(;FF[4]SZ[19])');
      }
    });
  });
});
