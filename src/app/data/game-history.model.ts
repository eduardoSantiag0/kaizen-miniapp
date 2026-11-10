/**
 * Modeled on the real backend's GameHistoryDto (HANDOFF.md section 7): a game's
 * three phase SGFs, each analysed independently. The real endpoint doesn't
 * exist yet; GameHistoryService below is the seam where it gets wired in.
 */
export interface GameHistoryDto {
  id: string;
  correlationId: string;
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
