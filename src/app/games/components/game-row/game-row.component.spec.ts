import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { GameRowComponent } from './game-row.component';
import { GameHistoryService } from '../../../data/game-history.service';
import { TelegramService } from '../../../core/telegram.service';
import type { GameHistoryDto } from '../../../data/game-history.model';
import type { GameListEntry } from '../../game-list-entry';

class StubGameHistoryService extends GameHistoryService {
  resignCalls: string[] = [];
  resignResult = new Subject<void>();

  override getGameHistory() {
    return of<GameHistoryDto>({
      id: 'g1',
      correlationId: 'c1',
      openingAnalysed: null,
      middlegameAnalysed: null,
      endgameAnalysed: null,
      blackPlayer: null,
      whitePlayer: null,
      gameRank: null,
    });
  }

  override listGames() {
    return of<GameHistoryDto[]>([]);
  }

  override resignGame(gameId: string) {
    this.resignCalls.push(gameId);
    return this.resignResult.asObservable();
  }
}

describe('GameRowComponent', () => {
  let fixture: ComponentFixture<GameRowComponent>;
  let gameHistory: StubGameHistoryService;
  let telegram: TelegramService;

  function entry(overrides: Partial<GameListEntry> = {}): GameListEntry {
    return {
      id: 'game-1',
      opponentName: 'kitsune77',
      opponentRank: '4k',
      boardSize: 19,
      server: 'OGS',
      moves: 91,
      date: '2026-11-09',
      status: 'done',
      mistakeMoveNumber: 75,
      mistakePhases: ['middlegame'],
      userSign: 1,
      result: 'B+R',
      won: true,
      ...overrides,
    };
  }

  function setEntry(e: GameListEntry, noDividerAbove = false): void {
    fixture = TestBed.createComponent(GameRowComponent);
    fixture.componentRef.setInput('entry', e);
    fixture.componentRef.setInput('noDividerAbove', noDividerAbove);
    fixture.detectChanges();
  }

  function link(): HTMLAnchorElement | null {
    return fixture.nativeElement.querySelector('.kz-game-row-link');
  }

  function actionButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.kz-game-action') as HTMLButtonElement;
  }

  beforeEach(() => {
    delete window.Telegram;
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: GameHistoryService, useClass: StubGameHistoryService }],
    });
    gameHistory = TestBed.inject(GameHistoryService) as unknown as StubGameHistoryService;
    telegram = TestBed.inject(TelegramService);
  });

  /** Drives GameAction's popup through to its destructive button without a real Telegram client. */
  function confirmAction(): void {
    spyOn(telegram, 'showPopup').and.callFake((_params, callback) => callback('confirm'));
    actionButton().click();
  }

  it('renders a "done" row with a mistake as a stretched link to its exercise, with the full accessible name', () => {
    setEntry(entry());

    const row = fixture.nativeElement.querySelector('.kz-game-row') as HTMLElement;
    expect(row).toBeTruthy();
    const a = link();
    expect(a).toBeTruthy();
    expect(a!.getAttribute('aria-label')).toBe('kitsune77, won B+R, 19 by 19, Biggest mistake · move 75');
    expect(a!.getAttribute('href')).toContain('/game/game-1');
  });

  it('renders the status line text per status', () => {
    setEntry(entry({ status: 'done', mistakeMoveNumber: 75 }));
    expect(fixture.nativeElement.textContent).toContain('Biggest mistake · move 75');

    setEntry(entry({ status: 'running' }));
    expect(fixture.nativeElement.textContent).toContain('KataGo is analyzing…');

    setEntry(entry({ status: 'waiting' }));
    expect(fixture.nativeElement.textContent).toContain('Queued for analysis');
  });

  it('a "done" row with nothing flagged (mistakeMoveNumber null) shows clean-game copy, is not a link, but still offers Delete', () => {
    setEntry(entry({ status: 'done', mistakeMoveNumber: null, mistakePhases: [] }));

    expect(fixture.nativeElement.textContent).toContain('No concerns found');
    expect(link()).toBeNull();
    expect(fixture.nativeElement.querySelector('.kz-game-row-right--no-chevron')).toBeTruthy();
    expect(actionButton().textContent?.trim()).toBe('Delete');
  });

  it('shows "N mistakes to study" with the phase list when more than one phase has a mistake', () => {
    setEntry(entry({ status: 'done', mistakeMoveNumber: 12, mistakePhases: ['opening', 'middlegame', 'endgame'] }));

    expect(fixture.nativeElement.textContent).toContain('3 mistakes to study · opening, middlegame, endgame');
    expect(link()).toBeTruthy(); // still a single tap into the game's own exercise collection, same link as before
  });

  it('renders a non-"done" row with no link, but a Cancel action', () => {
    setEntry(entry({ status: 'running' }));

    expect(link()).toBeNull();
    expect(actionButton().textContent?.trim()).toBe('Cancel');
  });

  it('shows a chevron only on a tappable row, with no-chevron padding on the other kind instead', () => {
    setEntry(entry({ status: 'done' }));
    expect(fixture.nativeElement.querySelector('.kz-game-row-chevron')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.kz-game-row-right--no-chevron')).toBeNull();

    setEntry(entry({ status: 'waiting' }));
    expect(fixture.nativeElement.querySelector('.kz-game-row-chevron')).toBeNull();
    expect(fixture.nativeElement.querySelector('.kz-game-row-right--no-chevron')).toBeTruthy();
  });

  it('colours "Won" shu and "Lost" hint via the --won modifier class', () => {
    setEntry(entry({ won: true }));
    let label = fixture.nativeElement.querySelector('.kz-game-row-outcome-label') as HTMLElement;
    expect(label.textContent?.trim()).toBe('Won');
    expect(label.classList.contains('kz-game-row-outcome-label--won')).toBe(true);

    setEntry(entry({ won: false }));
    label = fixture.nativeElement.querySelector('.kz-game-row-outcome-label') as HTMLElement;
    expect(label.textContent?.trim()).toBe('Lost');
    expect(label.classList.contains('kz-game-row-outcome-label--won')).toBe(false);
  });

  it('suppresses the divider above the first row of a section via noDividerAbove', () => {
    setEntry(entry(), true);
    const el = fixture.nativeElement.querySelector('.kz-game-row') as HTMLElement;
    expect(el.classList.contains('kz-game-row--no-divider')).toBe(true);
  });

  it('shows the user\'s stone colour in the thumbnail badge', () => {
    setEntry(entry({ userSign: 1 }));
    expect(fixture.nativeElement.querySelector('.kz-game-row-stone--white')).toBeNull();

    setEntry(entry({ userSign: -1 }));
    expect(fixture.nativeElement.querySelector('.kz-game-row-stone--white')).toBeTruthy();
  });

  it('goes pending, dims, drops the link and shows "Deleting…" once the player confirms deleting a done game', () => {
    setEntry(entry({ status: 'done' }));
    confirmAction();
    fixture.detectChanges();

    expect(gameHistory.resignCalls).toEqual(['game-1']);
    expect(fixture.nativeElement.querySelector('.kz-game-row--pending')).toBeTruthy();
    expect(link()).toBeNull();
    expect(fixture.nativeElement.querySelector('.kz-game-action')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Deleting…');
  });

  it('shows "Cancelling…" while a running game\'s cancel is in flight', () => {
    setEntry(entry({ status: 'running' }));
    confirmAction();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Cancelling…');
  });

  it('emits removed with the game id once the backend confirms', () => {
    setEntry(entry({ status: 'done' }));
    const removedIds: string[] = [];
    fixture.componentInstance.removed.subscribe((id) => removedIds.push(id));

    confirmAction();
    gameHistory.resignResult.next();
    gameHistory.resignResult.complete();

    expect(removedIds).toEqual(['game-1']);
  });

  it('puts the row back as it was if the request fails', () => {
    setEntry(entry({ status: 'done' }));
    gameHistory.resignGame = () => throwError(() => new Error('network error'));

    confirmAction();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.kz-game-row--pending')).toBeNull();
    expect(link()).toBeTruthy();
    expect(actionButton()).toBeTruthy();
  });
});
