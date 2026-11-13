import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ExercisePageComponent } from './exercise-page.component';
import { GameHistoryService } from '../data/game-history.service';
import { TelegramService } from '../core/telegram.service';
import type { GameHistoryDto } from '../data/game-history.model';

// Setup: AB[cc]AW[gg], user (Black) to move. KataGo's line: ec, fc, ed, fd.
// The mistake (actually played): fc. A plain distractor: gc.
// AW[hi][ih] additionally surrounds the corner ii ([8,8]) on both its liberties,
// so B[ii] is suicide — used only by the illegal-move haptic test below.
const BRANCHING_SGF =
  '(;FF[4]SZ[9]AB[cc]AW[gg][hi][ih]PL[B](;B[ec];W[fc];B[ed];W[fd])(;B[fc])(;B[gc]))';

class StubGameHistoryService extends GameHistoryService {
  dto: GameHistoryDto = {
    id: 'g1',
    correlationId: 'c1',
    openingAnalysed: null,
    middlegameAnalysed: BRANCHING_SGF,
    endgameAnalysed: null,
    blackPlayer: null,
    whitePlayer: null,
    gameRank: null,
  };

  readonly requestedGameIds: string[] = [];
  /** When set, getGameHistory fails this many times before falling back to dto — used to test the error screen's retry action. */
  failuresRemaining = 0;

  override getGameHistory(gameId: string) {
    this.requestedGameIds.push(gameId);
    if (this.failuresRemaining > 0) {
      this.failuresRemaining--;
      return throwError(() => new Error('network error'));
    }
    return of(this.dto);
  }

  override listGames() {
    return of([this.dto]);
  }
}

describe('ExercisePageComponent', () => {
  let fixture: ComponentFixture<ExercisePageComponent>;
  let stubHistory: StubGameHistoryService;

  beforeEach(() => {
    delete window.Telegram;
    TestBed.configureTestingModule({
      imports: [ExercisePageComponent],
      providers: [provideRouter([]), { provide: GameHistoryService, useClass: StubGameHistoryService }],
    });
    // Obtained (and mutable) before the component is created, since its
    // constructor subscribes to getGameHistory() synchronously.
    stubHistory = TestBed.inject(GameHistoryService) as unknown as StubGameHistoryService;
  });

  function createFixture(): ComponentFixture<ExercisePageComponent> {
    fixture = TestBed.createComponent(ExercisePageComponent);
    return fixture;
  }

  it('loads the mock exercise and reaches the ready screen', () => {
    createFixture().detectChanges();

    const state = fixture.componentInstance.state();
    expect(state.screen).toBe('ready');
    expect(state.phase).toBe('play');
    expect(state.totalSteps).toBe(2);
  });

  it('mounts the board into the DOM once ready', () => {
    createFixture().detectChanges();
    expect(fixture.nativeElement.querySelector('.shudan-goban')).not.toBeNull();
  });

  it('orders Board, then KaizenMessage, then ExerciseTools (user-requested order, overriding HANDOFF.md section 5 here)', () => {
    createFixture().detectChanges();

    const container = fixture.nativeElement.querySelector('.kz-exercise-page') as HTMLElement;
    const tags = Array.from(container.children).map((el) => el.tagName.toLowerCase());

    const boardIndex = tags.indexOf('kz-goban-view');
    const messageIndex = tags.indexOf('kz-kaizen-message');
    const toolsIndex = tags.indexOf('kz-exercise-tools');

    expect(boardIndex).toBeGreaterThanOrEqual(0);
    expect(messageIndex).toBeGreaterThan(boardIndex);
    expect(toolsIndex).toBeGreaterThan(messageIndex);
  });

  it('shows the sgfError screen when the SGF has no exercise branch point, still rendering KaizenMessage without Board/Tools', () => {
    stubHistory.dto = { ...stubHistory.dto, middlegameAnalysed: '(;FF[4]SZ[9];B[cc];W[gg])' };
    createFixture().detectChanges();

    expect(fixture.componentInstance.state().screen).toBe('sgfError');
    expect(fixture.nativeElement.querySelector('kz-kaizen-message')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('kz-goban-view')).toBeNull();
    expect(fixture.nativeElement.querySelector('kz-exercise-tools')).toBeNull();
  });

  it('shows a retryable error screen on a load failure, and "Try again" re-fetches the same game', () => {
    stubHistory.failuresRemaining = 1;
    createFixture().detectChanges();

    expect(fixture.componentInstance.state().screen).toBe('error');
    const button = fixture.nativeElement.querySelector('.kz-actions button') as HTMLButtonElement;
    expect(button.textContent?.trim()).toBe('Try again');

    button.click();
    fixture.detectChanges();

    expect(stubHistory.requestedGameIds.length).toBe(2);
    expect(fixture.componentInstance.state().screen).toBe('ready');
  });

  it('tapping a legal point plays it immediately, with no preview/confirm step', () => {
    createFixture().detectChanges();

    fixture.componentInstance.onVertexTap([4, 2]); // ec, correct

    expect(fixture.componentInstance.state().board.get([4, 2])).toBe(1);
  });

  it('plays a correct move, replies as the opponent after ~900ms, and advances the step', fakeAsync(() => {
    createFixture().detectChanges();

    fixture.componentInstance.onVertexTap([4, 2]); // ec

    expect(fixture.componentInstance.state().phase).toBe('reply');

    tick(900);

    const state = fixture.componentInstance.state();
    expect(state.phase).toBe('play');
    expect(state.step).toBe(2);
    expect(state.board.get([5, 2])).toBe(-1); // fc, the opponent's reply
  }));

  it('locks the board while the opponent is replying, so a tap during that window gets no affordance (Mobile-UX fix)', fakeAsync(() => {
    createFixture().detectChanges();

    fixture.componentInstance.onVertexTap([4, 2]); // ec, correct
    fixture.detectChanges();

    expect(fixture.componentInstance.state().phase).toBe('reply');
    const host = fixture.nativeElement.querySelector('kz-goban-adapter') as HTMLElement;
    expect(host.classList.contains('kz-goban-adapter--locked')).toBe(true);

    tick(900);
    fixture.detectChanges();

    expect(fixture.componentInstance.state().phase).toBe('play');
    expect(host.classList.contains('kz-goban-adapter--locked')).toBe(false);
  }));

  it('flags the specific "you played this in the game" wrong move, and locks the board while it shows', () => {
    createFixture().detectChanges();

    fixture.componentInstance.onVertexTap([5, 2]); // fc, the mistake
    fixture.detectChanges();

    const state = fixture.componentInstance.state();
    expect(state.phase).toBe('wrong');
    expect(state.wrongMove?.reason).toBe('mistakeMove');

    const host = fixture.nativeElement.querySelector('kz-goban-adapter') as HTMLElement;
    expect(host.classList.contains('kz-goban-adapter--locked')).toBe(true);
  });

  it('fires a warning haptic on an illegal-move tap (Mobile-UX fix)', () => {
    const telegram = TestBed.inject(TelegramService);
    spyOn(telegram, 'notificationHaptic');
    createFixture().detectChanges();

    fixture.componentInstance.onVertexTap([8, 8]); // ii, surrounded by AW[hi][ih] — suicide

    expect(fixture.componentInstance.state().illegal?.reason).toBe('suicide');
    expect(telegram.notificationHaptic).toHaveBeenCalledWith('warning');
  });

  it('does not fire a haptic for a plain legal tap', () => {
    const telegram = TestBed.inject(TelegramService);
    spyOn(telegram, 'notificationHaptic');
    createFixture().detectChanges();

    fixture.componentInstance.onVertexTap([4, 2]); // ec, legal and correct

    expect(telegram.notificationHaptic).not.toHaveBeenCalled();
  });

  it('onUndo reverts the last move via the Undo tool button', fakeAsync(() => {
    createFixture().detectChanges();

    fixture.componentInstance.onVertexTap([4, 2]); // ec, correct
    tick(900); // opponent's reply (fc), now at step 2
    expect(fixture.componentInstance.state().step).toBe(2);

    expect(fixture.componentInstance.canUndoState()).toBe(true);
    fixture.componentInstance.onUndo();
    fixture.detectChanges();

    const state = fixture.componentInstance.state();
    expect(state.phase).toBe('play');
    expect(state.step).toBe(1);
    expect(state.board.get([4, 2])).toBe(0);
  }));

  it('Undo is disabled on a fresh exercise and during the opponent-reply lock', fakeAsync(() => {
    createFixture().detectChanges();
    expect(fixture.componentInstance.canUndoState()).toBe(false);

    fixture.componentInstance.onVertexTap([4, 2]); // correct -> 'reply'
    expect(fixture.componentInstance.state().phase).toBe('reply');
    expect(fixture.componentInstance.canUndoState()).toBe(false);

    tick(900);
  }));

  it('clicking the real Undo button in the DOM reverts the last move', fakeAsync(() => {
    createFixture().detectChanges();

    fixture.componentInstance.onVertexTap([4, 2]); // ec, correct
    tick(900); // opponent's reply (fc), now at step 2
    fixture.detectChanges();

    const toolButtons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const undoButton = toolButtons.find((b) => b.textContent?.trim() === 'Undo') as HTMLButtonElement;
    expect(undoButton).toBeTruthy();
    expect(undoButton.disabled).toBe(false);

    undoButton.click();
    fixture.detectChanges();

    const state = fixture.componentInstance.state();
    expect(state.phase).toBe('play');
    expect(state.step).toBe(1);
    expect(state.board.get([4, 2])).toBe(0);
  }));

  it('hides the Tools row once the line is done, but keeps Board/Message visible (progressive disclosure)', fakeAsync(() => {
    createFixture().detectChanges();

    fixture.componentInstance.onVertexTap([4, 2]); // ec, correct
    tick(900); // opponent's reply (fc)
    fixture.componentInstance.onVertexTap([4, 3]); // ed, correct, final move
    fixture.detectChanges();

    expect(fixture.componentInstance.state().phase).toBe('done');
    expect(fixture.componentInstance.showTools()).toBe(false);

    const tools = fixture.nativeElement.querySelector('kz-exercise-tools') as HTMLElement;
    expect(tools.classList.contains('kz-tools--hidden')).toBe(true);
    expect(tools.getAttribute('aria-hidden')).toBe('true');

    // Board and message stay visible — only Tools hands off to Actions.
    expect(fixture.nativeElement.querySelector('.shudan-goban')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('kz-kaizen-message')).not.toBeNull();
  }));

  it('keeps Tools visible (not hidden) for the wrong phase — Undo/Reset/Hint/Zoom still matter there', () => {
    createFixture().detectChanges();

    fixture.componentInstance.onVertexTap([5, 2]); // fc, the mistake — wrong
    fixture.detectChanges();

    expect(fixture.componentInstance.state().phase).toBe('wrong');
    expect(fixture.componentInstance.showTools()).toBe(true);

    const tools = fixture.nativeElement.querySelector('kz-exercise-tools') as HTMLElement;
    expect(tools.classList.contains('kz-tools--hidden')).toBe(false);
  });

  it('shows Tools again after Reset brings a done exercise back to play', fakeAsync(() => {
    createFixture().detectChanges();

    fixture.componentInstance.onVertexTap([4, 2]);
    tick(900);
    fixture.componentInstance.onVertexTap([4, 3]);
    expect(fixture.componentInstance.state().phase).toBe('done');
    expect(fixture.componentInstance.showTools()).toBe(false);

    fixture.componentInstance.onReset();
    fixture.detectChanges();

    expect(fixture.componentInstance.state().phase).toBe('play');
    expect(fixture.componentInstance.showTools()).toBe(true);
  }));

  it('celebrate is true only while freshly done, and re-arms after a reset', fakeAsync(() => {
    createFixture().detectChanges();
    expect(fixture.componentInstance.celebrate()).toBe(false);

    fixture.componentInstance.onVertexTap([4, 2]);
    tick(900);
    fixture.componentInstance.onVertexTap([4, 3]);
    expect(fixture.componentInstance.celebrate()).toBe(true);

    fixture.componentInstance.onReset();
    expect(fixture.componentInstance.celebrate()).toBe(false);

    fixture.componentInstance.onVertexTap([4, 2]);
    tick(900);
    fixture.componentInstance.onVertexTap([4, 3]);
    expect(fixture.componentInstance.celebrate()).toBe(true);
  }));

  it('cancels a scheduled opponent reply and does not touch state after destroy', fakeAsync(() => {
    createFixture().detectChanges();
    fixture.componentInstance.onVertexTap([4, 2]);
    expect(fixture.componentInstance.state().phase).toBe('reply');

    fixture.destroy();

    expect(() => tick(900)).not.toThrow();
  }));

  // Reusability hooks for a future /practice session wrapper (not built here).
  describe('reusability inputs/outputs', () => {
    it('loads whichever gameId is bound, instead of a hardcoded id', () => {
      createFixture();
      fixture.componentRef.setInput('gameId', 'some-other-game');
      fixture.detectChanges();

      expect(stubHistory.requestedGameIds).toEqual(['some-other-game']);
    });

    it('reloads when gameId changes, as a session wrapper swapping exercises would', () => {
      createFixture().detectChanges();
      fixture.componentRef.setInput('gameId', 'next-exercise');
      fixture.detectChanges();

      expect(stubHistory.requestedGameIds).toEqual(['mock-game', 'next-exercise']);
    });

    it('shows the Telegram BackButton in menu mode (the default)', () => {
      const telegram = TestBed.inject(TelegramService);
      spyOn(telegram, 'showBackButton');

      createFixture().detectChanges();

      expect(telegram.showBackButton).toHaveBeenCalled();
    });

    it('skips the BackButton when menuMode is false, without building session close behaviour', () => {
      const telegram = TestBed.inject(TelegramService);
      spyOn(telegram, 'showBackButton');

      createFixture();
      fixture.componentRef.setInput('menuMode', false);
      fixture.detectChanges();

      expect(telegram.showBackButton).not.toHaveBeenCalled();
    });

    it('uses "Back to games" for a single-exercise game, and backToGames navigates on click', fakeAsync(() => {
      createFixture().detectChanges();
      expect(fixture.componentInstance.hasNext()).toBe(false);
      expect(fixture.componentInstance.correctSecondaryLabel()).toBe('Back to games');

      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');

      fixture.componentInstance.onVertexTap([4, 2]); // ec, correct
      tick(900); // opponent's reply (fc)
      fixture.componentInstance.onVertexTap([4, 3]); // ed, correct, final move
      fixture.detectChanges();

      expect(fixture.componentInstance.state().phase).toBe('done');

      let emitted = false;
      fixture.componentInstance.doneSecondaryAction.subscribe(() => (emitted = true));

      const buttons: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
      const button = buttons.find((el) => el.textContent?.includes('Back to games'));
      expect(button).toBeTruthy();
      button!.click();

      expect(emitted).toBe(true);
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    }));

    it('steps to the next exercise in the collection instead of navigating away, swapping the label and completion copy on the way', fakeAsync(() => {
      // Both phases parse into usable exercises, so this game has a 2-exercise collection.
      stubHistory.dto = { ...stubHistory.dto, openingAnalysed: BRANCHING_SGF, middlegameAnalysed: BRANCHING_SGF };
      createFixture().detectChanges();

      expect(fixture.componentInstance.hasNext()).toBe(true);
      expect(fixture.componentInstance.correctSecondaryLabel()).toBe('Next exercise');

      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');

      fixture.componentInstance.onVertexTap([4, 2]); // ec, correct
      tick(900); // opponent's reply (fc)
      fixture.componentInstance.onVertexTap([4, 3]); // ed, correct, final move
      fixture.detectChanges();

      expect(fixture.componentInstance.state().phase).toBe('done');
      expect(fixture.componentInstance.message().body).not.toContain('opening, middlegame and endgame');

      let emitted = false;
      fixture.componentInstance.doneSecondaryAction.subscribe(() => (emitted = true));

      const buttons: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
      const button = buttons.find((el) => el.textContent?.includes('Next exercise'));
      expect(button).toBeTruthy();
      button!.click();
      fixture.detectChanges();

      expect(emitted).toBe(true);
      expect(router.navigate).not.toHaveBeenCalled();

      // Landed on the second (last) exercise, freshly reset to 'play'.
      expect(fixture.componentInstance.state().phase).toBe('play');
      expect(fixture.componentInstance.state().step).toBe(1);
      expect(fixture.componentInstance.hasNext()).toBe(false);
      expect(fixture.componentInstance.correctSecondaryLabel()).toBe('Back to games');

      fixture.componentInstance.onVertexTap([4, 2]); // ec, correct
      tick(900);
      fixture.componentInstance.onVertexTap([4, 3]); // ed, correct, final move
      fixture.detectChanges();

      expect(fixture.componentInstance.state().phase).toBe('done');
      expect(fixture.componentInstance.message().body).toContain('opening, middlegame and endgame');
    }));
  });

  it('metaText shows both players, by name, not just the opponent', () => {
    const sgfWithNames =
      '(;FF[4]SZ[9]AB[cc]AW[gg]PB[the_user]BR[4k]PW[kitsune77]WR[3k]PC[OGS]PL[B](;B[ec])(;B[fc]))';
    stubHistory.dto = { ...stubHistory.dto, middlegameAnalysed: sgfWithNames };
    createFixture().detectChanges();

    expect(fixture.componentInstance.metaText()).toBe('the_user 4k vs kitsune77 3k · OGS');
  });

  it('keeps the player names in the same Black/White order across phases, even when the user\'s color differs between them (regression)', fakeAsync(() => {
    // Opening: user is Black (alice). Middlegame: same two players, but user is White (bob) this time.
    const openingUserIsBlack =
      '(;FF[4]SZ[9]AB[cc]AW[gg]PB[alice]BR[4k]PW[bob]WR[3k]PC[OGS]PL[B](;B[ec];W[fc])(;B[fc]))';
    const middlegameUserIsWhite =
      '(;FF[4]SZ[9]AB[cc]AW[gg]PB[alice]BR[4k]PW[bob]WR[3k]PC[OGS]PL[W](;W[ec];B[fc])(;W[fc]))';
    stubHistory.dto = {
      ...stubHistory.dto,
      openingAnalysed: openingUserIsBlack,
      middlegameAnalysed: middlegameUserIsWhite,
    };
    createFixture().detectChanges();

    expect(fixture.componentInstance.metaText()).toBe('alice 4k vs bob 3k · OGS');

    fixture.componentInstance.onVertexTap([4, 2]); // ec, correct
    tick(900);
    fixture.componentInstance.onDoneSecondary(); // advance to middlegame exercise
    fixture.detectChanges();

    expect(fixture.componentInstance.metaText()).toBe('alice 4k vs bob 3k · OGS');
  }));

  it('backToGames navigates to the root route (GamesPage)', () => {
    createFixture().detectChanges();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    fixture.componentInstance.backToGames();

    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });
});
