import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { forkJoin } from 'rxjs';
import { GameHistoryService } from './game-history.service';
import type { GameHistoryDto } from './game-history.model';

/**
 * Backed by the placeholder triplet in games_test/ (served from public/games_test/
 * so this goes through the same HttpClient path the real service will use —
 * swapping in the real endpoint later only means changing these three URLs).
 * There's only one mock game, so `gameId` is accepted but ignored.
 */
@Injectable()
export class MockGameHistoryService extends GameHistoryService {
  private readonly http = inject(HttpClient);

  private static readonly BASE = 'games_test';
  private static readonly FILES = {
    opening: 'gakutakunokumekriff_OPENING_0fbd7836-fc76-43ec-98a0-5967cb78a5e7.sgf',
    middlegame: 'gakutakunokumekriff_MIDDLEGAME_93ab7ec8-1c4a-4617-8af6-9272674c5a83.sgf',
    endgame: 'gakutakunokumekriff_ENDGAME_03cb365e-3c56-4462-8866-d46594d28142.sgf',
  } as const;

  getGameHistory(gameId: string): Observable<GameHistoryDto> {
    const { BASE, FILES } = MockGameHistoryService;

    return forkJoin({
      openingAnalysed: this.http.get(`${BASE}/${FILES.opening}`, { responseType: 'text' }),
      middlegameAnalysed: this.http.get(`${BASE}/${FILES.middlegame}`, { responseType: 'text' }),
      endgameAnalysed: this.http.get(`${BASE}/${FILES.endgame}`, { responseType: 'text' }),
    }).pipe(
      map((phases) => ({
        id: gameId,
        correlationId: 'mock-correlation-id',
        ...phases,
      }))
    );
  }
}
