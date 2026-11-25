import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, Observable, of, shareReplay } from 'rxjs';
import type { GameHistoryDto } from './game-history.model';

/**
 * The bundled practice-pool (public/practice-pool/practice-pool.json) —
 * KataGo-analysed games shipped with the frontend itself, not fetched from
 * any backend. Two independent uses read from this one cached source:
 * 'mixed' exerciseSource (MockPracticeService pads a thin own-games session
 * with it) and "Random practice" (builds a session from it alone, for
 * testing — see PracticeService.startRandomPractice). GameHistoryService's
 * own implementations also resolve a pool entry's gameId straight from here,
 * so an exercise built from the pool can still be opened and solved.
 */
@Injectable({ providedIn: 'root' })
export class PracticePoolService {
  private readonly http = inject(HttpClient);

  /** Fetched once and cached: the pool doesn't change at runtime, no reason to refetch it per session. Missing/broken bundle degrades to an empty pool, not a hard failure. */
  readonly pool$: Observable<GameHistoryDto[]> = this.http
    .get<GameHistoryDto[]>('practice-pool/practice-pool.json')
    .pipe(
      catchError(() => of([])),
      shareReplay(1),
    );

  findById(gameId: string): Observable<GameHistoryDto | undefined> {
    return this.pool$.pipe(map((pool) => pool.find((dto) => dto.id === gameId)));
  }
}
