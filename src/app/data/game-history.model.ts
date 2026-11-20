/**
 * Modeled on the real backend's GameHistoryDto (HANDOFF.md section 7): a game's
 * three phase SGFs, each analysed independently. The real endpoint doesn't
 * exist yet; GameHistoryService below is the seam where it gets wired in.
 */
export interface GameHistoryDto {
  id: string;
  correlationId: string;
  /**
   * Backend's GameHistoryItemDto field (see docs/backend-contract). Absent on
   * the mock fixtures' synthetic rows, which predate this field — treat a
   * missing status the same as 'DONE' (see deriveGameListEntry).
   * 'WAITING'/'RUNNING' rows have every field below as null — that's not a
   * clean finished game, it's a job still in RunPod's queue.
   */
  status?: 'DONE' | 'RUNNING' | 'WAITING';
  openingAnalysed: string | null;
  middlegameAnalysed: string | null;
  endgameAnalysed: string | null;
  /** From the original game's SGF PB[] tag. */
  blackPlayer: string | null;
  /** From the original game's SGF PW[] tag. */
  whitePlayer: string | null;
  /**
   * NOT always "{blackRank}/{whiteRank}" — that form only when both BR[] and
   * WR[] are present on the source SGF. A bare single rank (no slash) is a
   * valid value when only one side has a rank tag, and null when neither does.
   * See docs/backend-contract/history-endpoint-contract.md section 3.
   */
  gameRank: string | null;
}

export type GamePhase = 'opening' | 'middlegame' | 'endgame';
