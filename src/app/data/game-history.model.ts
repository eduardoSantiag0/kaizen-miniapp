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
}

export type GamePhase = 'opening' | 'middlegame' | 'endgame';
