import { Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Vertex } from '@sabaki/shudan';
import GoBoard from '@sabaki/go-board';
import { GameHistoryService } from '../data/game-history.service';
import { SgfParserService } from '../sgf/sgf-parser.service';
import { TelegramService } from '../core/telegram.service';
import { ExerciseContextComponent } from './components/exercise-context/exercise-context.component';
import { GobanViewComponent } from './components/goban-view/goban-view.component';
import { ExerciseToolsComponent } from './components/exercise-tools/exercise-tools.component';
import { KaizenMessageComponent } from './components/kaizen-message/kaizen-message.component';
import { ExerciseActionsComponent } from './components/exercise-actions/exercise-actions.component';
import { SeigaihaFillComponent } from '../shared/seigaiha-fill/seigaiha-fill.component';
import { PaperBackgroundComponent } from '../shared/paper-background/paper-background.component';
import { actionsFor, actionsForScreen, messageFor, messageForScreen, turnLineText } from './exercise-copy';
import { UnreadableExerciseError, type ExerciseLine } from './exercise-line';
import { loadExerciseCollection, type LoadedExercise } from './exercise-source';
import {
  canUndo,
  initExerciseState,
  playOpponentReply,
  playVertex,
  resetExercise,
  toggleHint,
  toggleZoom,
  undo,
  type ExerciseState,
} from './exercise-state';
import { UnreadableSgfError } from '../sgf/sgf-parser.service';

const OPPONENT_REPLY_DELAY_MS = 900;

@Component({
  selector: 'kz-exercise-page',
  imports: [
    ExerciseContextComponent,
    GobanViewComponent,
    ExerciseToolsComponent,
    KaizenMessageComponent,
    ExerciseActionsComponent,
    SeigaihaFillComponent,
    PaperBackgroundComponent,
  ],
  templateUrl: './exercise-page.component.html',
  styleUrl: './exercise-page.component.scss',
})
export class ExercisePageComponent {
  private readonly gameHistory = inject(GameHistoryService);
  private readonly sgfParser = inject(SgfParserService);
  private readonly telegram = inject(TelegramService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  /**
   * Which game to load. A future /practice session wrapper drives several
   * exercises through one ExercisePage by rebinding this per exercise,
   * instead of this component owning a fixed id itself.
   */
  readonly gameId = input('mock-game');

  /**
   * Whether this screen was opened from the games menu (Telegram BackButton,
   * returning there) as opposed to a future session mode (Close only, no
   * BackButton — HANDOFF.md section 6). Session mode's own header/exit
   * wiring isn't built here; this flag only keeps that from being
   * structurally impossible to add later without touching this component.
   */
  readonly menuMode = input(true);

  /** Fires whenever the 'done' phase's primary action is clicked, whether it advanced to the next exercise or went back to games — a future session wrapper can observe this without owning the behavior itself. */
  readonly doneSecondaryAction = output<void>();

  /**
   * Every phase of this game that produced a usable exercise (chronological:
   * opening, middlegame, endgame — see loadExerciseCollection), and which one
   * is currently showing. "Next exercise" steps forward through this; there's
   * no backend field saying which phases exist, so this is derived per game,
   * not driven by an external input.
   */
  private readonly collection = signal<LoadedExercise[]>([]);
  private readonly collectionIndex = signal(0);
  private readonly exercise = computed<LoadedExercise | null>(() => this.collection()[this.collectionIndex()] ?? null);
  readonly hasNext = computed(() => this.collectionIndex() < this.collection().length - 1);
  /** Label for the 'done' phase's primary action — swaps automatically, no external override needed. */
  readonly correctSecondaryLabel = computed(() => (this.hasNext() ? 'Next exercise' : 'Back to games'));
  readonly state = signal<ExerciseState>({
    screen: 'loading',
    phase: 'play',
    board: GoBoard.fromDimensions(19),
    step: 1,
    totalSteps: 0,
    illegal: null,
    lastMove: null,
    wrongMove: null,
    hintOn: false,
    zoomedIn: false,
    turnSign: 1,
  });

  readonly line = computed(() => this.exercise()?.line ?? null);
  readonly metaText = computed(() => {
    const exercise = this.exercise();
    if (!exercise) return '';
    const players = exercise.blackLabel ? `${exercise.blackLabel} vs ${exercise.whiteLabel}` : `vs ${exercise.whiteLabel}`;
    return exercise.server ? `${players} · ${exercise.server}` : players;
  });

  readonly message = computed(() => {
    const line = this.line();
    // messageForScreen/actionsForScreen only return null for 'ready', and line is only ever
    // null before a 'ready' state exists (see loadGame), so the fallbacks below never run.
    return line ? messageFor(this.state(), line, !this.hasNext()) : messageForScreen(this.state().screen)!;
  });

  readonly actions = computed(() => {
    const line = this.line();
    return line ? actionsFor(this.state()) : actionsForScreen(this.state().screen)!;
  });

  readonly canUndoState = computed(() => this.line() !== null && canUndo(this.state()));

  /** Progressive disclosure: once the line is done, the Tools row hands off entirely to ExerciseActions — kept visible for 'wrong' (Undo/Reset/Hint/Zoom still matter there). */
  readonly showTools = computed(() => this.state().screen === 'ready' && this.state().phase !== 'done');

  /**
   * Drives KaizenMessage's localized "Correct!" badge/glow (replacing the old
   * screen-wide SuccessVignette). A plain boolean is enough: it's only ever
   * true while phase === 'done', and every path back into 'done' passes
   * through 'play' first (Reset or Undo), so the badge's @if in the template
   * naturally remounts — and replays its entrance animation — on every fresh
   * completion without needing a bump-counter.
   */
  readonly celebrate = computed(() => this.state().phase === 'done');

  readonly turnText = computed(() => {
    const line = this.line();
    return line ? turnLineText(this.state(), line) : this.state().screen === 'loading' ? 'Loading game' : 'Game unavailable';
  });

  readonly turnSign = computed(() => (this.state().phase === 'done' ? null : this.state().turnSign));

  readonly zoomDisabled = computed(() => (this.line()?.boardSize ?? 19) <= 13);

  private replyTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.telegram.disableVerticalSwipes();

    // Reactive (not read once at construction) so a future session wrapper
    // could flip between menu/session mode without reconstructing this
    // component. hideBackButton is harmless to call when never shown.
    effect(() => {
      if (this.menuMode()) {
        this.telegram.showBackButton(this.backToGames);
      } else {
        this.telegram.hideBackButton(this.backToGames);
      }
    });

    this.destroyRef.onDestroy(() => {
      clearTimeout(this.replyTimer);
      this.telegram.hideBackButton(this.backToGames);
      this.telegram.enableVerticalSwipes();
    });

    // Reruns whenever gameId changes, so a future session wrapper can drive
    // several exercises through this component by rebinding the input.
    effect(() => this.loadGame(this.gameId()));
  }

  private loadGame(gameId: string): void {
    this.state.update((s) => ({ ...s, screen: 'loading' }));

    this.gameHistory.getGameHistory(gameId).subscribe({
      next: (dto) => {
        try {
          const collection = loadExerciseCollection(dto, this.sgfParser);
          this.collection.set(collection);
          this.collectionIndex.set(0);
          this.state.set(initExerciseState(collection[0].line));
        } catch (error) {
          if (error instanceof UnreadableSgfError || error instanceof UnreadableExerciseError) {
            this.state.update((s) => ({ ...s, screen: 'sgfError' }));
          } else {
            throw error;
          }
        }
      },
      error: () => this.state.update((s) => ({ ...s, screen: 'error' })),
    });
  }

  /** Tapping a point plays it immediately — no preview/confirm step. */
  onVertexTap(vertex: Vertex): void {
    const line = this.line();
    const current = this.state();
    if (!line || current.screen !== 'ready') return;

    const next = playVertex(current, line, vertex);
    this.state.set(next);

    if (next.illegal) {
      this.telegram.notificationHaptic('warning');
    } else if (next.phase === 'wrong') {
      this.telegram.notificationHaptic('error');
    } else if (next.phase === 'reply') {
      this.scheduleOpponentReply(line);
    } else if (next.phase === 'done') {
      this.telegram.notificationHaptic('success');
    }
  }

  /** General "undo my last move" recovery — replaces the old preview/Cancel step now that taps play instantly. Also what the 'wrong' phase's "Try again" action calls. */
  onUndo(): void {
    const line = this.line();
    if (line) this.state.update((s) => undo(s, line));
  }

  onReset(): void {
    const line = this.line();
    if (line) this.state.set(resetExercise(line));
  }

  onHintToggle(): void {
    this.state.update((s) => toggleHint(s));
  }

  onZoomToggle(): void {
    this.state.update((s) => toggleZoom(s));
  }

  readonly backToGames = (): void => {
    this.router.navigate(['/']);
  };

  /**
   * The 'done' phase's secondary action: steps to the next exercise in this
   * game's collection while one remains (correctSecondaryLabel already reads
   * "Next exercise" in that case), otherwise falls back to "Back to games".
   * doneSecondaryAction fires either way, for a future session wrapper to observe.
   */
  onDoneSecondary(): void {
    this.doneSecondaryAction.emit();

    if (this.hasNext()) {
      this.collectionIndex.update((i) => i + 1);
      const next = this.exercise();
      if (next) this.state.set(initExerciseState(next.line));
    } else {
      this.backToGames();
    }
  }

  private scheduleOpponentReply(line: ExerciseLine): void {
    clearTimeout(this.replyTimer);
    this.replyTimer = setTimeout(() => {
      this.state.update((s) => playOpponentReply(s, line));
    }, OPPONENT_REPLY_DELAY_MS);
  }
}
