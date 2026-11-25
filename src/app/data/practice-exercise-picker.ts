import type { GameHistoryDto, GamePhase } from './game-history.model';
import type { DailyPracticeSession, PracticeExerciseRef } from './practice.model';
import type { SgfParserService } from '../sgf/sgf-parser.service';
import { buildExerciseTree } from '../exercise/exercise-tree';
import type { SgfNode } from '../sgf/sgf-node';
import { BLACK, moveOf, WHITE } from '../sgf/sgf-node';

/** Chronological order — same convention as exercise-source.ts/game-list-entry.ts. */
const PHASE_ORDER: { phase: GamePhase; key: keyof GameHistoryDto }[] = [
  { phase: 'opening', key: 'openingAnalysed' },
  { phase: 'middlegame', key: 'middlegameAnalysed' },
  { phase: 'endgame', key: 'endgameAnalysed' },
];

/**
 * Local calendar date as "YYYY-MM-DD" — NOT `.toISOString().slice(0, 10)`,
 * which reports the date in UTC: in any negative-UTC-offset timezone, that
 * flips to tomorrow's date for a window around local midnight (as early as
 * 21:00 local at UTC-3), one real calendar day before it actually is locally.
 * A session's own `date` needs to track the user's local day, same as the
 * SGF DT[] dates game-list-format.ts's parseLocalDate reads.
 */
/** Unique id for a new session — `crypto.randomUUID()` is available in every environment this app actually runs in (secure context: HTTPS/Telegram WebView, or localhost in dev). */
export function newSessionId(): string {
  return crypto.randomUUID();
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Fisher-Yates, not a sort-by-random-key — doesn't mutate its argument. */
export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Shared by MockPracticeService (the chat's own games, optionally padded
 * with the practice-pool) and HttpPracticeService's startRandomPractice
 * (the practice-pool alone) — picks up to `count` exercise-able phases
 * across the given games, skipping any phase with no usable branch point.
 * `shuffled`: shuffles every (game, phase) candidate pair up front rather
 * than just the games list, since otherwise a single game's own phases would
 * always come out in the same opening/middlegame/endgame order regardless
 * of game order.
 */
export function pickExercises(
  sgfParser: SgfParserService,
  dtos: GameHistoryDto[],
  options: { count: number; shuffled?: boolean; topVariants?: number; continuationDepth?: number },
): PracticeExerciseRef[] {
  let candidates = dtos.flatMap((dto) => PHASE_ORDER.map(({ phase, key }) => ({ dto, phase, key })));
  if (options.shuffled) candidates = shuffle(candidates);

  const refs: PracticeExerciseRef[] = [];

  for (const { dto, phase, key } of candidates) {
    const sgf = dto[key];
    if (typeof sgf !== 'string') continue;

    try {
      const root = sgfParser.parse(sgf).root;
      buildExerciseTree(root); // throws if there's no usable branch point
      refs.push({
        id: `${dto.id}-${phase}`,
        gameId: dto.id,
        phase,
        completed: false,
        topVariants: options.topVariants ?? 3,
        currentDepth: options.continuationDepth ?? 4,
        selectedVariant: null,
        step: 1,
        ...displayInfo(root),
      });
    } catch {
      // Not exercise-able (no branch point, or unreadable) — skip, same as game-list-entry.ts.
    }

    if (refs.length >= options.count) return refs;
  }

  return refs;
}

/** Same derivation GamesPage's GameListEntry uses — see game-list-entry.ts. */
function displayInfo(root: SgfNode): Pick<PracticeExerciseRef, 'opponentName' | 'opponentRank' | 'boardSize' | 'userSign' | 'moveNumber'> {
  const userSign = root.data['PL']?.[0] === 'W' ? WHITE : BLACK;
  const blackName = root.data['PB']?.[0] ?? '';
  const whiteName = root.data['PW']?.[0] ?? '';
  const blackRank = root.data['BR']?.[0] ?? '';
  const whiteRank = root.data['WR']?.[0] ?? '';

  return {
    userSign,
    opponentName: userSign === BLACK ? whiteName : blackName,
    opponentRank: userSign === BLACK ? whiteRank : blackRank,
    boardSize: Number(root.data['SZ']?.[0] ?? 19),
    moveNumber: branchPointDepth(root),
  };
}

/** 1-based move number of the first node with more than one child (buildExerciseTree's branch point) — same as game-list-entry.ts's branchPointDepth. */
function branchPointDepth(root: SgfNode): number {
  let count = 0;
  let node: SgfNode | undefined = root;
  while (node && node.children.length === 1) {
    if (moveOf(node)) count++;
    node = node.children[0];
  }
  return count + 1;
}

export function cloneSession(session: DailyPracticeSession): DailyPracticeSession {
  return { ...session, exercises: session.exercises.map((e) => ({ ...e })) };
}
