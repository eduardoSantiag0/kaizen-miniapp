import { Observable } from 'rxjs';
import type { GameHistoryDto } from './game-history.model';

/**
 * Abstraction over the (not yet implemented) backend endpoint. Swapping the
 * mock for the real HTTP call is a one-file change: provide a different class
 * for this token in app.config.ts — nothing that injects GameHistoryService
 * needs to change.
 */
export abstract class GameHistoryService {
  abstract getGameHistory(gameId: string): Observable<GameHistoryDto>;
  /** GamesPage's list — the real backend only ever exposes "all of the chat's games" (no filtering/single-game lookup server-side; see docs/backend-contract). */
  abstract listGames(): Observable<GameHistoryDto[]>;
}
