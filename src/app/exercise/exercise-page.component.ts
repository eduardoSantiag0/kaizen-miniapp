import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, defer, map, of, throwError } from 'rxjs';
import type { Vertex } from '@sabaki/shudan';
import GoBoard from '@sabaki/go-board';
import { GameHistoryService } from '../data/game-history.service';
import type { GamePhase } from '../data/game-history.model';
import { SgfParserService } from '../sgf/sgf-parser.service';
import { TelegramService } from '../core/telegram.service';
import { ExerciseContextComponent } from './components/exercise-context/exercise-context.component';
import { GobanViewComponent } from './components/goban-view/goban-view.component';
import { ExerciseToolsComponent } from './components/exercise-tools/exercise-tools.component';
import { KaizenMessageComponent } from './components/kaizen-message/kaizen-message.component';
import { ExerciseActionsComponent } from './components/exercise-actions/exercise-actions.component';
import { LineCompleteActionsComponent } from './components/line-complete-actions/line-complete-actions.component';
import { SeigaihaFillComponent } from '../shared/seigaiha-fill/seigaiha-fill.component';
import { PaperBackgroundComponent } from '../shared/paper-background/paper-background.component';
import { actionsFor, actionsForScreen, messageFor, messageForScreen, turnLineText } from './exercise-copy';
import { UnreadableExerciseError, type ExerciseTree } from './exercise-tree';
import { loadExerciseCollection, loadExerciseFromSgf, type LoadedExercise } from './exercise-source';
import {
  canUndo,
  goDeeper,
  hasMoreToGoDeeper,
  initExerciseState,
  playOpponentReply,
  playVertex,
  resetExercise,
  resumeExerciseState,
  toggleHint,
  toggleZoom,
  undo,
  type ExerciseProgress,
  type ExerciseState,
} from './exercise-state';
import { UnreadableSgfError } from '../sgf/sgf-parser.service';

const OPPONENT_REPLY_DELAY_MS = 900;

export type ExercisePageMode = 'menu' | 'daily';

@Component({
  selector: 'kz-exercise-page',
  imports: [
    ExerciseContextComponent,
    GobanViewComponent,
    ExerciseToolsComponent,
    KaizenMessageComponent,
    ExerciseActionsComponent,
    LineCompleteActionsComponent,
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
   * Whether the Telegram BackButton shows at all. True in both menu mode
   * (returning to Games) and daily mode (returning to Daily Practice Home —
   * handoff v4-kaizen-daily-practice section 6, which supersedes the older
   * pre-v4 HANDOFF.md section 6 assumption of "Close only, no BackButton" for
   * a session mode); backToGames() below already picks the right target per
   * mode(). Exists as its own input mainly so a menu-mode caller could still
   * suppress it if ever needed, without this component owning that decision.
   *
   * Read through `menuModeOn` everywhere below, never bare: `withComponentInputBinding`
   * (app.config.ts) overwrites every input that has no matching route param/data/query-param
   * to `undefined` for a *routed* instantiation — exactly what `/game/:gameId` is — discarding
   * this input's own declared default and silently hiding the Telegram BackButton on every
   * menu-mode exercise. The daily-mode usage (PracticeSessionComponent's `<kz-exercise-page>`)
   * is a plain child-template binding, never routed, so it never hit this.
   */
  readonly menuMode = input(true);
  private readonly menuModeOn = computed(() => this.menuMode() ?? true);

  /**
   * 'daily' reuses this whole screen for one Daily Practice exercise
   * (handoff section 6/11) instead of walking gameId's own 3-phase
   * collection: a session wrapper drives several different games' exercises
   * through this one component by rebinding gameId/phase per exercise.
   *
   * Read through `modeOn` everywhere below — see `menuModeOn`'s comment above,
   * the same router gotcha applies here.
   */
  readonly mode = input<ExercisePageMode>('menu');
  private readonly modeOn = computed<ExercisePageMode>(() => this.mode() ?? 'menu');
  /** Daily mode only: which single phase to load — skips the menu-mode "try all 3 phases" heuristic entirely, since the session already knows. */
  readonly phase = input<GamePhase | null>(null);
  /** Daily mode only: this exercise's own SGF, already resolved by the session wrapper (PracticeExerciseRef.sgf) — personal or dataset alike, same shape either way. Menu mode fetches its own SGF instead, via gameId/GameHistoryService. */
  readonly sgf = input<string | null>(null);
  /** Daily mode only: Continuation Depth (M) preference, the starting point before any "Go deeper" taps — handoff section 5/7. Ignored in menu mode. */
  readonly depth = input(4);
  private readonly depthOn = computed(() => this.depth() ?? 4);
  /** Daily mode only: Accepted first moves (Top Variants, N) preference — handoff section 5/7. Clamps the loaded exercise to KataGo's first N first-move candidates (already ranked best-first). null (menu mode) leaves every stored variant accepted. */
  readonly topVariants = input<number | null>(null);
  /** Daily mode only: precomputed "Exercise k of n" position text — the session wrapper owns session-position arithmetic, this component only displays it. */
  readonly sessionLabel = input<string | null>(null);
  /** Daily mode only: whether this is the last exercise in the session — swaps LineCompleteActions' primary label to "Finish practice" (handoff section 6). The session wrapper owns session-position arithmetic, same as sessionLabel. */
  readonly isLastExercise = input(false);
  /** Daily mode only: resumes the exercise at this saved position instead of starting fresh — handoff v4-3-kaizen-daily-practice section 9. null starts fresh (new exercise, or no saved progress yet). */
  readonly progress = input<ExerciseProgress | null>(null);

  /** Fires whenever the 'done' phase's primary action is clicked, whether it advanced to the next exercise or went back to games — a future session wrapper can observe this without owning the behavior itself. */
  readonly doneSecondaryAction = output<void>();
  /** Daily mode: fires the first time this exercise reaches 'done' (not again on a later Go deeper re-completion) — the session wrapper records this via PracticeService. */
  readonly exerciseSolved = output<void>();
  /** Daily mode: fires when LineCompleteActions' primary button ("Next exercise"/"Finish practice") is tapped. */
  readonly dailyNext = output<void>();
  /** Daily mode: fires after every confirmed move, Try another line and Go deeper — the session wrapper persists this via PracticeService.saveProgress (handoff section 9). */
  readonly progressChanged = output<ExerciseProgress>();

  /**
   * Every phase of this game that produced a usable exercise (chronological:
   * opening, middlegame, endgame — see loadExerciseCollection), and which one
   * is currently showing. "Next exercise" steps forward through this; there's
   * no backend field saying which phases exist, so this is derived per game,
   * not driven by an external input. Menu mode only — daily mode uses
   * dailyExercise below instead.
   */
  private readonly collection = signal<LoadedExercise[]>([]);
  private readonly collectionIndex = signal(0);
  private readonly dailyExercise = signal<LoadedExercise | null>(null);
  private readonly exercise = computed<LoadedExercise | null>(() =>
    this.modeOn() === 'daily' ? this.dailyExercise() : this.collection()[this.collectionIndex()] ?? null,
  );
  readonly hasNext = computed(() => this.collectionIndex() < this.collection().length - 1);
  /** Label for the 'done' phase's primary action — swaps automatically, no external override needed. Menu mode only. */
  readonly correctSecondaryLabel = computed(() => (this.hasNext() ? 'Next exercise' : 'Back to games'));

  /** Continuation Depth as it currently stands for this exercise — starts at `depth()`, rises by Go deeper taps, resets to `depth()` on Try another line. Daily mode only. */
  private readonly currentDepth = signal(4);
  /** The maxPlies argument playVertex/goDeeper expect — daily mode derives it from currentDepth (handoff section 7: `plies = min(1 + M, available)`); menu mode passes the default (10), which is provably identical to the old `min(5, ceil(len/2))` formula for every branch length exercise-tree.ts can ever produce. */
  private readonly effectiveMaxPlies = computed(() => (this.modeOn() === 'daily' ? 1 + this.currentDepth() : 10));
  private readonly nextGoDeeperDepth = computed(() => Math.min(10, this.currentDepth() + 2));
  /** Drives LineCompleteActions' "Go deeper" disabled state — shown but disabled once KataGo's stored analysis is exhausted (handoff section 6), never hidden. */
  readonly canGoDeeper = computed(() => {
    const line = this.line();
    return !!line && hasMoreToGoDeeper(this.state(), line, 1 + this.nextGoDeeperDepth());
  });

  private solvedEmitted = false;
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

  readonly line = computed(() => this.exercise()?.line ?? null);
  readonly metaText = computed(() => {
    const exercise = this.exercise();
    if (!exercise) return '';
    const players = exercise.blackLabel ? `${exercise.blackLabel} vs ${exercise.whiteLabel}` : `vs ${exercise.whiteLabel}`;
    const base = exercise.server ? `${players} · ${exercise.server}` : players;
    const label = this.sessionLabel();
    return label ? `${label} · ${base}` : base;
  });

  readonly message = computed(() => {
    const line = this.line();
    // messageForScreen/actionsForScreen only return null for 'ready', and line is only ever
    // null before a 'ready' state exists (see loadGame), so the fallbacks below never run.
    const isFinalExercise = this.modeOn() === 'daily' ? false : !this.hasNext();
    return line ? messageFor(this.state(), line, isFinalExercise) : messageForScreen(this.state().screen)!;
  });

  readonly actions = computed(() => {
    const line = this.line();
    return line ? actionsFor(this.state()) : actionsForScreen(this.state().screen)!;
  });

  /**
   * The in-page "‹ Games" button in ExerciseContext — daily mode never shows
   * it (Telegram's own BackButton is the only way back there, see menuModeOn's
   * comment), and menu mode hides it too wherever the bottom action area
   * already offers its own "Back to games" button (the sgfError screen, and
   * 'done' with no more exercises in this game) — otherwise the player would
   * see two ways back to Games at once.
   */
  readonly showContextBack = computed(() => {
    if (this.modeOn() === 'daily') return false;
    const kind = this.actions().kind;
    if (kind === 'backToGames') return false;
    if (kind === 'correct' && !this.hasNext()) return false;
    return true;
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
      if (this.menuModeOn()) {
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

    // Reruns whenever gameId (or, in daily mode, phase/sgf) changes, so a
    // session wrapper can drive several exercises through this component by
    // rebinding the inputs.
    effect(() => this.loadGame(this.gameId(), this.phase(), this.sgf()));

    // Save after every confirmed move, Try another line and Go deeper
    // (handoff v4-3 section 9) — 'play'/'done' are the only stable states;
    // 'wrong' isn't a confirmed move, and 'reply' is a transient ~900ms
    // animation this never persists mid-way through.
    effect(() => {
      if (this.modeOn() !== 'daily') return;
      const s = this.state();
      if (s.screen !== 'ready' || (s.phase !== 'play' && s.phase !== 'done')) return;

      this.progressChanged.emit({ selectedVariant: s.selectedVariant, step: s.step, currentDepth: this.currentDepth() });
    });
  }

  /**
   * The only thing that differs between menu and daily mode is how the
   * exercise(s) get loaded — menu mode fetches a GameHistoryDto by gameId and
   * tries each of its 3 phases, daily mode already has its one exercise's own
   * SGF in hand. Both converge on the exact same Observable shape
   * (LoadedExercise | LoadedExercise[]) and the exact same single subscribe
   * below, which is the one place that turns a loaded exercise into
   * execution state — there is no second, parallel execution path for daily
   * mode once the data is in hand.
   */
  private loadGame(gameId: string, phase: GamePhase | null, sgf: string | null): void {
    this.state.update((s) => ({ ...s, screen: 'loading' }));
    this.solvedEmitted = false;
    // untracked: progress() changes on every move (via the save round-trip through the
    // session wrapper), and must not retrigger this reload effect — it, and depth(), are
    // meant to be read once per exercise load, not reactively afterward (handoff section
    // 12 open question 4: a preference change applies from the next exercise, not this one).
    const progress = untracked(() => this.progress());
    this.currentDepth.set(progress?.currentDepth ?? untracked(() => this.depthOn()));

    const isDaily = this.modeOn() === 'daily';
    const loaded$: Observable<LoadedExercise | LoadedExercise[]> = isDaily
      ? this.loadDailyExercise(phase, sgf)
      : this.gameHistory.getGameHistory(gameId).pipe(map((dto) => loadExerciseCollection(dto, this.sgfParser)));

    loaded$.subscribe({
      next: (result) => {
        if (isDaily) {
          const exercise = result as LoadedExercise;
          const topVariants = this.topVariants();
          if (topVariants !== null) {
            exercise.line = { ...exercise.line, variants: exercise.line.variants.slice(0, Math.max(1, topVariants)) };
          }
          this.dailyExercise.set(exercise);
          this.state.set(
            progress ? resumeExerciseState(exercise.line, progress, 1 + this.currentDepth()) : initExerciseState(exercise.line),
          );
        } else {
          const collection = result as LoadedExercise[];
          this.collection.set(collection);
          this.collectionIndex.set(0);
          this.state.set(initExerciseState(collection[0].line));
        }
      },
      error: (error) => {
        if (error instanceof UnreadableSgfError || error instanceof UnreadableExerciseError) {
          // Deterministic, not transient — this exact gameId/phase will never parse, so
          // "Try again" will fail identically every time. Logged so a stuck exercise is
          // diagnosable instead of a silent dead end (handoff v5-1: the Daily Practice flow).
          console.error(`Exercise unreadable for game ${gameId} (${phase ?? 'menu mode'}):`, error);
          this.state.update((s) => ({ ...s, screen: 'sgfError' }));
        } else {
          console.error(`Failed to load game ${gameId}`, error);
          this.state.update((s) => ({ ...s, screen: 'error' }));
        }
      },
    });
  }

  /** defer: loadExerciseFromSgf can throw synchronously (unparsable/unbranchable SGF) — defer's factory catches that and turns it into this Observable's own error notification, the same channel a failed HTTP fetch uses, so loadGame's single subscribe above never needs two different error-handling shapes. */
  private loadDailyExercise(phase: GamePhase | null, sgf: string | null): Observable<LoadedExercise> {
    if (!phase || !sgf) return throwError(() => new UnreadableExerciseError('Daily mode requires phase and sgf'));
    return defer(() => of(loadExerciseFromSgf(sgf, phase, this.sgfParser)));
  }

  /** Tapping a point plays it immediately — no preview/confirm step. */
  onVertexTap(vertex: Vertex): void {
    const line = this.line();
    const current = this.state();
    if (!line || current.screen !== 'ready') return;

    const next = playVertex(current, line, vertex, this.effectiveMaxPlies());
    this.state.set(next);
    this.afterMove(next, line);
  }

  /** General "undo my last move" recovery — replaces the old preview/Cancel step now that taps play instantly. Also what the 'wrong' phase's "Try again" action calls. */
  onUndo(): void {
    const line = this.line();
    if (line) this.state.update((s) => undo(s, line));
  }

  /** Menu mode's Reset tool, and daily mode's "Try another line" (handoff section 6: "goes back to the starting position with the depth reset to the setting"). */
  onReset(): void {
    const line = this.line();
    if (!line) return;
    if (this.modeOn() === 'daily') this.currentDepth.set(this.depthOn());
    this.state.set(resetExercise(line));
  }

  /** Daily mode's "Go deeper +2" (handoff section 7): raises the Continuation Depth by 2 (capped at 10) and reveals that much more of the already-chosen variant. No-op if canGoDeeper() was already false. */
  onGoDeeper(): void {
    const line = this.line();
    if (!line || this.modeOn() !== 'daily') return;

    const nextDepth = this.nextGoDeeperDepth();
    const next = goDeeper(this.state(), line, 1 + nextDepth);
    if (next === this.state()) return;

    this.currentDepth.set(nextDepth);
    this.state.set(next);
    if (next.phase === 'reply') this.scheduleOpponentReply(line);
  }

  /** Daily mode's LineCompleteActions primary button ("Next exercise"/"Finish practice") — the session wrapper owns what actually happens next. */
  onDailyNext(): void {
    this.dailyNext.emit();
  }

  /** The 'error' screen's primary action: re-fetches the same game instead of forcing a trip back to GamesPage first, matching GamesPage's own retry() for a transient load failure. */
  onRetryLoad(): void {
    this.loadGame(this.gameId(), this.phase(), this.sgf());
  }

  onHintToggle(): void {
    this.state.update((s) => toggleHint(s));
  }

  onZoomToggle(): void {
    this.state.update((s) => toggleZoom(s));
  }

  /** Back always goes one level up (handoff section 2): Games in menu mode, Daily Practice Home in daily mode. */
  readonly backToGames = (): void => {
    this.router.navigate([this.modeOn() === 'daily' ? '/practice' : '/']);
  };

  /**
   * The 'done' phase's secondary action: steps to the next exercise in this
   * game's collection while one remains (correctSecondaryLabel already reads
   * "Next exercise" in that case), otherwise falls back to "Back to games".
   * doneSecondaryAction fires either way, for a future session wrapper to observe.
   * Menu mode only — daily mode's equivalent is onDailyNext/dailyNext above.
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

  private afterMove(next: ExerciseState, line: ExerciseTree): void {
    if (next.illegal) {
      this.telegram.notificationHaptic('warning');
    } else if (next.phase === 'wrong') {
      this.telegram.notificationHaptic('error');
    } else if (next.phase === 'reply') {
      this.scheduleOpponentReply(line);
    } else if (next.phase === 'done') {
      this.telegram.notificationHaptic('success');
      this.emitSolvedOnce();
    }
  }

  private emitSolvedOnce(): void {
    if (this.solvedEmitted) return;
    this.solvedEmitted = true;
    this.exerciseSolved.emit();
  }

  private scheduleOpponentReply(line: ExerciseTree): void {
    clearTimeout(this.replyTimer);
    this.replyTimer = setTimeout(() => {
      const next = playOpponentReply(this.state(), line);
      this.state.set(next);
      if (next.phase === 'done') {
        this.telegram.notificationHaptic('success');
        this.emitSolvedOnce();
      }
    }, OPPONENT_REPLY_DELAY_MS);
  }
}
