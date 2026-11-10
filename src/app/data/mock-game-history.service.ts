import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { forkJoin } from 'rxjs';
import { GameHistoryService } from './game-history.service';
import type { GameHistoryDto } from './game-history.model';
import { SgfParserService } from '../sgf/sgf-parser.service';

/**
 * Backed by the placeholder triplet in games_test/ (served from public/games_test/
 * so this goes through the same HttpClient path the real service will use —
 * swapping in the real endpoint later only means changing these three URLs).
 * There's only one real mock game, so `gameId` is accepted but ignored.
 */
@Injectable()
export class MockGameHistoryService extends GameHistoryService {
  private readonly http = inject(HttpClient);
  private readonly sgfParser = inject(SgfParserService);

  private static readonly BASE = 'games_test';
  private static readonly FILES = {
    opening: 'gakutakunokumekriff_OPENING_0fbd7836-fc76-43ec-98a0-5967cb78a5e7.sgf',
    middlegame: 'gakutakunokumekriff_MIDDLEGAME_93ab7ec8-1c4a-4617-8af6-9272674c5a83.sgf',
    endgame: 'gakutakunokumekriff_ENDGAME_03cb365e-3c56-4462-8866-d46594d28142.sgf',
  } as const;

  /**
   * Synthetic — invented for list-UI testing, not derived from any real game
   * (same documented-mock-only convention as exercise-line.ts's branch-order
   * assumption). There's only one real fixture triplet, which can't alone
   * exercise GamesPage's Today/Earlier grouping, all three filter tabs, every
   * analysis status, or both a won and a lost outcome — these three rows
   * cover the rest: one 'running'+OGS+today (so "Today" has something besides
   * whatever the real game's date happens to be), one 'running'+DGS+yesterday
   * (so the DGS tab isn't always zero), and one all-null entry — which
   * deriveGameListEntry now reads as 'done' with nothing flagged ("a clean
   * game"), not 'waiting' (see that function's own doc comment for why an
   * all-null row can never mean "not started yet"). Dates are computed
   * relative to "now" at call time, not hardcoded, so this still lands in
   * "Today"/"Yesterday" correctly whenever the app actually runs.
   */
  private static syntheticGames(): GameHistoryDto[] {
    const isoDaysAgo = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return d.toISOString().slice(0, 10);
    };

    return [
      {
        id: 'mock-game-running-today',
        correlationId: 'mock-correlation-running-today',
        // A valid SGF with no branch point — "some analysis exists" but not exercise-ready yet.
        openingAnalysed: `(;FF[4]SZ[19]PB[yuki_go]PW[sanshiro]BR[7k]WR[6k]PC[OGS]DT[${isoDaysAgo(0)}]RE[W+12.5]PL[B];B[pd];W[dp];B[pq];W[dd])`,
        middlegameAnalysed: null,
        endgameAnalysed: null,
        blackPlayer: 'yuki_go',
        whitePlayer: 'sanshiro',
        gameRank: '7k/6k',
      },
      {
        id: 'mock-game-running-dgs',
        correlationId: 'mock-correlation-running-dgs',
        openingAnalysed: `(;FF[4]SZ[13]PB[rivercrab]PW[echizen_go]BR[2d]WR[1d]PC[DGS: dragongoserver.net]DT[${isoDaysAgo(1)}]RE[B+9.5]PL[W];W[jd];B[dj];W[jj];B[dd])`,
        middlegameAnalysed: null,
        endgameAnalysed: null,
        blackPlayer: 'rivercrab',
        whitePlayer: 'echizen_go',
        gameRank: '2d/1d',
      },
      {
        id: 'mock-game-clean',
        correlationId: 'mock-correlation-clean',
        openingAnalysed: null,
        middlegameAnalysed: null,
        endgameAnalysed: null,
        blackPlayer: null,
        whitePlayer: 'hoshi_no_go',
        gameRank: '3d',
      },
    ];
  }

  getGameHistory(gameId: string): Observable<GameHistoryDto> {
    return this.fetchRealGame(gameId);
  }

  /**
   * The real backend's only endpoint returns every one of the chat's games in
   * one array (no per-game lookup, no filtering) — see
   * docs/backend-contract/history-endpoint-contract.md. There's only one real
   * fixture triplet, so this appends three synthetic, unfetched entries purely
   * to exercise GamesPage's 'running' state and the 'done'-but-clean case, and
   * its multi-row layout generally.
   */
  listGames(): Observable<GameHistoryDto[]> {
    return this.fetchRealGame('mock-game').pipe(
      map((realGame) => [realGame, ...MockGameHistoryService.syntheticGames()])
    );
  }

  private fetchRealGame(gameId: string): Observable<GameHistoryDto> {
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
        ...this.derivePlayersInfo(phases.openingAnalysed ?? phases.middlegameAnalysed ?? phases.endgameAnalysed),
      }))
    );
  }

  /** Mirrors the real backend's AnalysisAggregator.setPlayersInfo (see history-endpoint-contract.md section 3). */
  private derivePlayersInfo(sgfText: string): Pick<GameHistoryDto, 'blackPlayer' | 'whitePlayer' | 'gameRank'> {
    let root;
    try {
      root = this.sgfParser.parse(sgfText).root;
    } catch {
      return { blackPlayer: null, whitePlayer: null, gameRank: null };
    }

    const blackPlayer = root.data['PB']?.[0] ?? null;
    const whitePlayer = root.data['PW']?.[0] ?? null;
    const blackRank = root.data['BR']?.[0] ?? null;
    const whiteRank = root.data['WR']?.[0] ?? null;

    const gameRank = blackRank && whiteRank ? `${blackRank}/${whiteRank}` : (blackRank ?? whiteRank ?? null);

    return { blackPlayer, whitePlayer, gameRank };
  }
}
