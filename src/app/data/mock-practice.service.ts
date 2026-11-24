import { Injectable, inject } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { GameHistoryService } from './game-history.service';
import type { GameHistoryDto, GamePhase } from './game-history.model';
import { PracticeService } from './practice.service';
import {
  DEFAULT_PRACTICE_PREFERENCES,
  type DailyPracticeSession,
  type PracticeExerciseRef,
  type PracticePreferences,
  type StreakInfo,
} from './practice.model';
import type { ExerciseProgress } from '../exercise/exercise-state';
import { SgfParserService } from '../sgf/sgf-parser.service';
import { buildExerciseTree } from '../exercise/exercise-tree';
import type { SgfNode } from '../sgf/sgf-node';
import { BLACK, moveOf, WHITE } from '../sgf/sgf-node';

const MAX_EXERCISES_PER_SESSION = 5;

/** Chronological order — same convention as exercise-source.ts/game-list-entry.ts. */
const PHASE_ORDER: { phase: GamePhase; key: keyof GameHistoryDto }[] = [
  { phase: 'opening', key: 'openingAnalysed' },
  { phase: 'middlegame', key: 'middlegameAnalysed' },
  { phase: 'endgame', key: 'endgameAnalysed' },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Session-local Daily Practice backend, no network — built on top of
 * whichever GameHistoryService is configured (the real mock fixtures in
 * dev), so exercises are picked the same way a real backend would: from
 * analysed games' phase SGFs that actually have a usable branch point
 * (buildExerciseTree doesn't throw). Resets on page reload — there is no
 * real persistence here, see docs/backend-contract/daily-practice-endpoint-proposal.md.
 */
@Injectable()
export class MockPracticeService extends PracticeService {
  private readonly gameHistory = inject(GameHistoryService);
  private readonly sgfParser = inject(SgfParserService);

  private session: DailyPracticeSession | null = null;
  private preferences: PracticePreferences = { ...DEFAULT_PRACTICE_PREFERENCES };

  getTodaySession(): Observable<DailyPracticeSession | null> {
    return of(this.session ? cloneSession(this.session) : null);
  }

  startTodaySession(): Observable<DailyPracticeSession> {
    if (this.session) return of(cloneSession(this.session));

    return this.gameHistory.listGames().pipe(
      map((dtos) => {
        const exercises = this.pickExercises(dtos);
        this.session = { date: todayIso(), exercises, completed: exercises.length === 0 };
        return cloneSession(this.session);
      }),
    );
  }

  recordResult(exerciseId: string): Observable<void> {
    const exercise = this.session?.exercises.find((e) => e.id === exerciseId);
    if (exercise && this.session) {
      exercise.completed = true;
      this.session.completed = this.session.exercises.every((e) => e.completed);
    }
    return of(undefined);
  }

  saveProgress(exerciseId: string, progress: ExerciseProgress): Observable<void> {
    const exercise = this.session?.exercises.find((e) => e.id === exerciseId);
    if (exercise) {
      exercise.selectedVariant = progress.selectedVariant;
      exercise.step = progress.step;
      exercise.currentDepth = progress.currentDepth;
    }
    return of(undefined);
  }

  getPreferences(): Observable<PracticePreferences> {
    return of({ ...this.preferences });
  }

  setPreferences(preferences: PracticePreferences): Observable<void> {
    this.preferences = { ...preferences };
    return of(undefined);
  }

  /** No real multi-day persistence in the mock — just reflects whether today's session is done. */
  getStreak(): Observable<StreakInfo> {
    const doneToday = this.session?.completed ?? false;
    return of({ currentStreak: doneToday ? 1 : 0, last7Days: [false, false, false, false, false, false, doneToday] });
  }

  private pickExercises(dtos: GameHistoryDto[]): PracticeExerciseRef[] {
    const refs: PracticeExerciseRef[] = [];

    for (const dto of dtos) {
      for (const { phase, key } of PHASE_ORDER) {
        const sgf = dto[key];
        if (typeof sgf !== 'string') continue;

        try {
          const root = this.sgfParser.parse(sgf).root;
          buildExerciseTree(root); // throws if there's no usable branch point
          refs.push({
            id: `${dto.id}-${phase}`,
            gameId: dto.id,
            phase,
            completed: false,
            topVariants: this.preferences.topVariants,
            currentDepth: this.preferences.continuationDepth,
            selectedVariant: null,
            step: 1,
            ...displayInfo(root),
          });
        } catch {
          // Not exercise-able (no branch point, or unreadable) — skip, same as game-list-entry.ts.
        }

        if (refs.length >= MAX_EXERCISES_PER_SESSION) return refs;
      }
    }

    return refs;
  }
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

function cloneSession(session: DailyPracticeSession): DailyPracticeSession {
  return { ...session, exercises: session.exercises.map((e) => ({ ...e })) };
}
