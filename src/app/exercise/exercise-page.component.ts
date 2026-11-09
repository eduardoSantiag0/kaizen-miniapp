import { Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
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
import { loadExercise, type LoadedExercise } from './exercise-source';
import {
  cancelPreview,
  confirmMove,
  initExerciseState,
  playOpponentReply,
  resetExercise,
  tapVertex,
  toggleHint,
  toggleZoom,
  tryAgain,
  vertexEquals,
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

  /** Label for the 'done' phase's secondary action — "Back to games" from the menu, something else in a session. */
  readonly correctSecondaryLabel = input('Back to games');

  /** Fires when the 'done' phase's secondary action is clicked. A menu-mode caller can ignore it (default behaviour is a no-op, matching today's single-exercise flow); a session wrapper can listen for "next exercise" later. */
  readonly doneSecondaryAction = output<void>();

  private readonly exercise = signal<LoadedExercise | null>(null);
  readonly state = signal<ExerciseState>({
    screen: 'loading',
    phase: 'play',
    board: GoBoard.fromDimensions(19),
    step: 1,
    totalSteps: 0,
    preview: null,
    illegal: null,
    lastMove: null,
    wrongMove: null,
    hintOn: false,
    zoomedIn: true,
    turnSign: 1,
  });

  readonly line = computed(() => this.exercise()?.line ?? null);
  readonly metaText = computed(() => {
    const exercise = this.exercise();
    return exercise ? `vs ${exercise.opponentLabel} · ${exercise.server}` : '';
  });

  readonly message = computed(() => {
    const line = this.line();
    // messageForScreen/actionsForScreen only return null for 'ready', and line is only ever
    // null before a 'ready' state exists (see loadGame), so the fallbacks below never run.
    return line ? messageFor(this.state(), line) : messageForScreen(this.state().screen)!;
  });

  readonly actions = computed(() => {
    const line = this.line();
    return line ? actionsFor(this.state(), line) : actionsForScreen(this.state().screen)!;
  });

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
          const loaded = loadExercise(dto, this.sgfParser);
          this.exercise.set(loaded);
          this.state.set(initExerciseState(loaded.line));
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

  onVertexTap(vertex: Vertex): void {
    const line = this.line();
    const current = this.state();
    if (!line || current.screen !== 'ready') return;

    if (current.phase === 'play' && current.preview && vertexEquals(current.preview, vertex)) {
      this.play();
      return;
    }

    const next = tapVertex(current, line, vertex);
    this.state.set(next);

    if (next.illegal) {
      this.telegram.notificationHaptic('warning');
    }
  }

  play(): void {
    const line = this.line();
    if (!line) return;

    const next = confirmMove(this.state(), line);
    this.state.set(next);

    if (next.phase === 'wrong') {
      this.telegram.notificationHaptic('error');
    } else if (next.phase === 'reply') {
      this.scheduleOpponentReply(line);
    } else if (next.phase === 'done') {
      this.telegram.notificationHaptic('success');
    }
  }

  cancel(): void {
    this.state.update((s) => cancelPreview(s));
  }

  onTryAgain(): void {
    const line = this.line();
    if (line) this.state.update((s) => tryAgain(s, line));
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
    // GamesPage doesn't exist yet (out of scope for this build); this is its wiring target.
  };

  /** The 'done' phase's secondary action (menu mode: "Back to games"; a future session wrapper can listen to doneSecondaryAction instead to do something else, e.g. "Next exercise"). */
  onDoneSecondary(): void {
    this.doneSecondaryAction.emit();
    this.backToGames();
  }

  private scheduleOpponentReply(line: ExerciseLine): void {
    clearTimeout(this.replyTimer);
    this.replyTimer = setTimeout(() => {
      this.state.update((s) => playOpponentReply(s, line));
    }, OPPONENT_REPLY_DELAY_MS);
  }
}
