import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import type { Vertex } from '@sabaki/shudan';
import GoBoard from '@sabaki/go-board';
import { GameHistoryService } from '../data/game-history.service';
import type { GameHistoryDto, GamePhase } from '../data/game-history.model';
import { PracticeService } from '../data/practice.service';
import { DEFAULT_PRACTICE_PREFERENCES, type DailyPracticeSession, type PracticeExerciseRef, type PracticePreferences } from '../data/practice.model';
import { SgfParserService, UnreadableSgfError } from '../sgf/sgf-parser.service';
import { TelegramService } from '../core/telegram.service';
import { GobanViewComponent } from '../exercise/components/goban-view/goban-view.component';
import { ExerciseToolsComponent } from '../exercise/components/exercise-tools/exercise-tools.component';
import { KaizenMessageComponent } from '../exercise/components/kaizen-message/kaizen-message.component';
import { PaperBackgroundComponent } from '../shared/paper-background/paper-background.component';
import { SeigaihaFillComponent } from '../shared/seigaiha-fill/seigaiha-fill.component';
import { buildExerciseTree, UnreadableExerciseError, type ExerciseTree } from '../exercise/exercise-tree';
import {
  canUndo,
  goDeeper,
  initExerciseState,
  playOpponentReply,
  playVertex,
  resetExercise,
  toggleHint,
  toggleZoom,
  undo,
  type ExerciseState,
} from '../exercise/exercise-state';

const OPPONENT_REPLY_DELAY_MS = 900;

type Screen = 'loading' | 'ready' | 'error' | 'sgfError' | 'summary';

/**
 * RF03.2/RF03.3/RF03.5/RF03.7 — Daily Practice's session flow. A sibling to
 * ExercisePageComponent, reusing the same low-level engine (buildExerciseTree,
 * exercise-state.ts's functions, GobanViewComponent, ExerciseToolsComponent)
 * but with session-level orchestration ExercisePage doesn't have: stepping
 * through several different games' exercises, applying Practice Preferences,
 * recording per-exercise results, and the Next/Try Another Line/Go Deeper
 * choices plus a completion summary.
 */
@Component({
  selector: 'kz-daily-practice-session',
  imports: [GobanViewComponent, ExerciseToolsComponent, KaizenMessageComponent, PaperBackgroundComponent, SeigaihaFillComponent],
  templateUrl: './daily-practice-session.component.html',
  styleUrl: './daily-practice-session.component.scss',
})
export class DailyPracticeSessionComponent {
  private readonly practice = inject(PracticeService);
  private readonly gameHistory = inject(GameHistoryService);
  private readonly sgfParser = inject(SgfParserService);
  private readonly telegram = inject(TelegramService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  readonly screen = signal<Screen>('loading');
  private readonly session = signal<DailyPracticeSession | null>(null);
  private readonly currentExerciseId = signal<string | null>(null);
  readonly tree = signal<ExerciseTree | null>(null);
  readonly state = signal<ExerciseState>({
    screen: 'loading',
    phase: 'play',
    board: GoBoard.fromDimensions(19),
    selectedVariant: null,
    step: 1,
    totalSteps: 0,
    illegal: null,
    lastMove: null,
    wrongMove: null,
    hintOn: false,
    zoomedIn: false,
    turnSign: 1,
  });

  private preferences: PracticePreferences = { ...DEFAULT_PRACTICE_PREFERENCES };
  private replyTimer?: ReturnType<typeof setTimeout>;

  readonly currentExercise = computed<PracticeExerciseRef | null>(() => {
    const session = this.session();
    const id = this.currentExerciseId();
    return session?.exercises.find((e) => e.id === id) ?? null;
  });

  readonly hasNext = computed(() => {
    const session = this.session();
    const current = this.currentExercise();
    if (!session || !current) return false;
    const index = session.exercises.findIndex((e) => e.id === current.id);
    return index >= 0 && index < session.exercises.length - 1;
  });

  readonly summary = computed(() => {
    const exercises = this.session()?.exercises ?? [];
    return {
      completed: exercises.filter((e) => e.completed).length,
    };
  });

  readonly canUndoState = computed(() => canUndo(this.state()));

  constructor() {
    this.telegram.disableVerticalSwipes();
    this.telegram.showBackButton(this.backToHome);

    this.destroyRef.onDestroy(() => {
      clearTimeout(this.replyTimer);
      this.telegram.hideBackButton(this.backToHome);
      this.telegram.enableVerticalSwipes();
    });

    this.loadSession();
  }

  retry(): void {
    this.loadSession();
  }

  private loadSession(): void {
    this.screen.set('loading');

    forkJoin({
      session: this.practice.startTodaySession(),
      preferences: this.practice.getPreferences(),
    }).subscribe({
      next: ({ session, preferences }) => {
        this.preferences = preferences;
        this.session.set(session);

        if (session.exercises.length === 0 || session.completed) {
          this.screen.set('summary');
          return;
        }

        const next = session.exercises.find((e) => !e.completed) ?? session.exercises[0];
        this.loadExercise(next.id);
      },
      error: () => this.screen.set('error'),
    });
  }

  private loadExercise(exerciseId: string): void {
    const exercise = this.session()?.exercises.find((e) => e.id === exerciseId);
    if (!exercise) return;

    this.screen.set('loading');
    this.currentExerciseId.set(exerciseId);

    this.gameHistory.getGameHistory(exercise.gameId).subscribe({
      next: (dto) => {
        try {
          const sgf = phaseSgf(dto, exercise.phase);
          if (!sgf) throw new UnreadableExerciseError('No SGF for this phase');

          const fullTree = buildExerciseTree(this.sgfParser.parse(sgf).root);
          const clampedTree = clampVariants(fullTree, this.preferences.topVariants);

          this.tree.set(clampedTree);
          this.state.set(initExerciseState(clampedTree));
          this.screen.set('ready');
        } catch (error) {
          if (error instanceof UnreadableSgfError || error instanceof UnreadableExerciseError) {
            this.screen.set('sgfError');
          } else {
            throw error;
          }
        }
      },
      error: () => this.screen.set('error'),
    });
  }

  onVertexTap(vertex: Vertex): void {
    const tree = this.tree();
    const current = this.state();
    if (!tree || this.screen() !== 'ready') return;

    const next = clampTotalSteps(playVertex(current, tree, vertex), this.preferences);
    this.state.set(next);

    if (next.illegal) {
      this.telegram.notificationHaptic('warning');
    } else if (next.phase === 'wrong') {
      this.telegram.notificationHaptic('error');
    } else if (next.phase === 'reply') {
      this.scheduleOpponentReply();
    } else if (next.phase === 'done') {
      this.telegram.notificationHaptic('success');
      this.recordCurrentResult();
    }
  }

  private scheduleOpponentReply(): void {
    clearTimeout(this.replyTimer);
    this.replyTimer = setTimeout(() => {
      const tree = this.tree();
      if (!tree) return;

      const next = playOpponentReply(this.state(), tree);
      this.state.set(next);

      if (next.phase === 'done') {
        this.telegram.notificationHaptic('success');
        this.recordCurrentResult();
      }
    }, OPPONENT_REPLY_DELAY_MS);
  }

  private recordCurrentResult(): void {
    const exercise = this.currentExercise();
    if (!exercise || exercise.completed) return; // already recorded (e.g. re-reaching 'done' after Go Deeper)

    this.practice.recordResult(exercise.id).subscribe(() => {
      this.session.update((session) => {
        if (!session) return session;
        const exercises = session.exercises.map((e) =>
          e.id === exercise.id ? { ...e, completed: true } : e,
        );
        return { ...session, exercises, completed: exercises.every((e) => e.completed) };
      });
    });
  }

  onUndo(): void {
    const tree = this.tree();
    if (tree) this.state.update((s) => undo(s, tree));
  }

  /** RF03.5 "Try Another Line": same exercise, fresh pick among the offered variants. */
  onTryAnotherLine(): void {
    const tree = this.tree();
    if (tree) this.state.set(resetExercise(tree));
  }

  /** RF03.5 "Go Deeper": continue the same chosen variant beyond the preference-capped depth, up to what's really stored. */
  onGoDeeper(): void {
    const tree = this.tree();
    if (!tree) return;

    const nextDepth = Math.min(10, this.preferences.continuationDepth + 2);
    const next = goDeeper(this.state(), tree, 1 + nextDepth);
    if (next === this.state()) return;

    this.preferences = { ...this.preferences, continuationDepth: nextDepth };
    this.state.set(next);
    if (next.phase === 'reply') this.scheduleOpponentReply();
  }

  /** RF03.5 "Next Exercise" / RF03.7 completion. */
  onNextExercise(): void {
    const session = this.session();
    const current = this.currentExercise();
    if (!session || !current) return;

    const index = session.exercises.findIndex((e) => e.id === current.id);
    const next = session.exercises[index + 1];

    if (next) {
      this.loadExercise(next.id);
    } else {
      this.screen.set('summary');
    }
  }

  onHintToggle(): void {
    this.state.update((s) => toggleHint(s));
  }

  onZoomToggle(): void {
    this.state.update((s) => toggleZoom(s));
  }

  readonly backToHome = (): void => {
    this.router.navigate(['/']);
  };
}

function phaseSgf(dto: GameHistoryDto, phase: GamePhase): string | null {
  switch (phase) {
    case 'opening':
      return dto.openingAnalysed;
    case 'middlegame':
      return dto.middlegameAnalysed;
    case 'endgame':
      return dto.endgameAnalysed;
  }
}

/** RF02.2 Top Variants (N): offers only the N best-ranked candidates (KatagoAssembler already orders them best-first). */
function clampVariants(tree: ExerciseTree, topVariants: number): ExerciseTree {
  return { ...tree, variants: tree.variants.slice(0, Math.max(1, topVariants)) };
}

/**
 * RF02.2/RF03.4 Continuation Depth (M): M counts plies after the initial
 * move (which doesn't count itself), while this engine's totalSteps counts
 * rounds (user move + reply). Approximating 1 initial round + ceil(M/2)
 * further rounds — with today's backend capping each variant at 6 plies
 * (3 rounds), this clamp is a no-op for the default M=6 and only matters
 * once that backend-side cap is ever raised, or M is set low. A pure number
 * clamp — the existing isLastStep checks in playVertex/playOpponentReply
 * already re-derive from state.totalSteps on every subsequent move, so
 * nothing else needs to change here.
 */
function clampTotalSteps(state: ExerciseState, preferences: PracticePreferences): ExerciseState {
  if (state.selectedVariant === null) return state;

  const roundsAllowed = Math.max(1, 1 + Math.ceil(preferences.continuationDepth / 2));
  if (state.totalSteps <= roundsAllowed) return state;

  return { ...state, totalSteps: roundsAllowed };
}
