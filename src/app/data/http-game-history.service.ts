import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { TelegramService } from '../core/telegram.service';
import { GameHistoryService } from './game-history.service';
import type { GameHistoryDto } from './game-history.model';
import { PracticePoolService } from './practice-pool.service';

/**
 * Real HTTP-backed GameHistoryService, per
 * docs/backend-contract/history-endpoint-contract.md: GET /history returns
 * every one of the chat's games/jobs in one array — there is no per-game
 * lookup endpoint.
 */
@Injectable()
export class HttpGameHistoryService extends GameHistoryService {
  private readonly http = inject(HttpClient);
  private readonly telegram = inject(TelegramService);
  private readonly practicePool = inject(PracticePoolService);

  private static readonly HISTORY_PATH = '/kaizan/api/v1/katago/history';

  listGames(): Observable<GameHistoryDto[]> {
    return this.http.get<GameHistoryDto[]>(
      `${environment.apiBaseUrl}${HttpGameHistoryService.HISTORY_PATH}`,
      { headers: { Authorization: `tma ${this.telegram.initData}` } },
    );
  }

  /**
   * A 'mixed'/"Random practice" exercise's gameId may be one of the bundled
   * practice-pool's own entries, which the real backend has never heard of —
   * checked first (no network call), before asking the backend for one of
   * the chat's own real games.
   */
  getGameHistory(gameId: string): Observable<GameHistoryDto> {
    return this.practicePool.findById(gameId).pipe(
      switchMap((pooled) => {
        if (pooled) return of(pooled);
        return this.listGames().pipe(
          switchMap((games) => {
            const found = games.find((game) => game.id === gameId);
            return found ? of(found) : throwError(() => new Error(`Game ${gameId} not found`));
          }),
        );
      }),
    );
  }

  /**
   * DELETE /history/{id}: cancels a running/queued job the same as the
   * Telegram /resign command, or deletes an already-analysed game — the
   * backend decides which, based on the id (docs/backend-contract/resign-endpoint-proposal.md).
   */
  resignGame(gameId: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiBaseUrl}${HttpGameHistoryService.HISTORY_PATH}/${gameId}`,
      { headers: { Authorization: `tma ${this.telegram.initData}` } },
    );
  }
}
