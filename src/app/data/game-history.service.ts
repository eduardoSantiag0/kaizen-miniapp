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
}
