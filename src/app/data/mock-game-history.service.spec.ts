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

  it('fetches all three phase SGFs and maps them onto a GameHistoryDto, ignoring the gameId', (done) => {
    service.getGameHistory('whatever-id').subscribe((dto) => {
      expect(dto.id).toBe('whatever-id');
      expect(dto.correlationId).toBeTruthy();
      expect(dto.openingAnalysed).toBe('OPENING SGF TEXT');
      expect(dto.middlegameAnalysed).toBe('MIDDLEGAME SGF TEXT');
      expect(dto.endgameAnalysed).toBe('ENDGAME SGF TEXT');
      done();
    });

    const requests = httpMock.match(() => true);
    expect(requests.length).toBe(3);

    for (const req of requests) {
      expect(req.request.method).toBe('GET');
      if (req.request.url.includes('OPENING')) req.flush('OPENING SGF TEXT');
      else if (req.request.url.includes('MIDDLEGAME')) req.flush('MIDDLEGAME SGF TEXT');
      else if (req.request.url.includes('ENDGAME')) req.flush('ENDGAME SGF TEXT');
    }
  });
});
