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

  function menuTrigger(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.kz-game-menu-trigger') as HTMLButtonElement;
  }

  function menuItem(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('.kz-game-menu-item');
  }

  beforeEach(() => {
    delete window.Telegram;
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: GameHistoryService, useClass: StubGameHistoryService }],
    });
    gameHistory = TestBed.inject(GameHistoryService) as unknown as StubGameHistoryService;
    telegram = TestBed.inject(TelegramService);
  });

  /** Drives the ⋮ menu's popup through to its destructive button without a real Telegram client. */
  function confirmAction(): void {
    spyOn(telegram, 'showPopup').and.callFake((_params, callback) => callback('confirm'));
    menuTrigger().click();
    fixture.detectChanges();
    menuItem()!.click();
  }

  it('renders a "done" row with a mistake as a stretched link to its exercise, with the full accessible name', () => {
    setEntry(entry());

    const row = fixture.nativeElement.querySelector('.kz-game-row') as HTMLElement;
    expect(row).toBeTruthy();
    const a = link();
    expect(a).toBeTruthy();
    expect(a!.getAttribute('aria-label')).toBe('kitsune77, won B+R, 19 by 19, OGS · 19×19 · Nov 9');
    expect(a!.getAttribute('href')).toContain('/game/game-1');
  });

  it('renders the second line text per status', () => {
    setEntry(entry({ status: 'done', mistakeMoveNumber: 75 }));
    expect(fixture.nativeElement.textContent).toContain('OGS · 19×19 · Nov 9');

    setEntry(entry({ status: 'running' }));
    expect(fixture.nativeElement.textContent).toContain('⏱ KataGo is analyzing this game…');

    setEntry(entry({ status: 'waiting' }));
    expect(fixture.nativeElement.textContent).toContain('⏱ Waiting for analysis');
  });

  it('a "done" row with nothing flagged (mistakePhases empty) shows "No mistakes to practice", is not a link, but still offers Delete', () => {
    setEntry(entry({ status: 'done', mistakeMoveNumber: null, mistakePhases: [] }));

    expect(fixture.nativeElement.textContent).toContain('No mistakes to practice');
    expect(link()).toBeNull();
    expect(fixture.nativeElement.querySelector('.kz-game-row-right--no-chevron')).toBeTruthy();
    expect(menuItem()).toBeNull(); // closed until opened
    menuTrigger().click();
    fixture.detectChanges();
    expect(menuItem()!.textContent?.trim()).toBe('Delete game');
  });

  it('still shows the "Won · B+R" result badge alongside "No mistakes to practice"', () => {
    setEntry(entry({ status: 'done', mistakeMoveNumber: null, mistakePhases: [], won: true, result: 'B+R' }));

    expect(fixture.nativeElement.querySelector('.kz-game-row-result')!.textContent?.trim()).toBe('Won · B+R');
  });

  it('renders a non-"done" row with no link, but a Cancel action in the ⋮ menu', () => {
    setEntry(entry({ status: 'running' }));

    expect(link()).toBeNull();
    menuTrigger().click();
    fixture.detectChanges();
    expect(menuItem()!.textContent?.trim()).toBe('Cancel analysis');
  });

  it('shows a chevron only on a tappable row, with no-chevron padding on the other kind instead', () => {
    setEntry(entry({ status: 'done' }));
    expect(fixture.nativeElement.querySelector('.kz-game-row-chevron')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.kz-game-row-right--no-chevron')).toBeNull();

    setEntry(entry({ status: 'waiting' }));
    expect(fixture.nativeElement.querySelector('.kz-game-row-chevron')).toBeNull();
    expect(fixture.nativeElement.querySelector('.kz-game-row-right--no-chevron')).toBeTruthy();
  });

  it('colours "Won" with the won token and "Lost" with the alert token', () => {
    setEntry(entry({ won: true, result: 'B+R' }));
    let result = fixture.nativeElement.querySelector('.kz-game-row-result') as HTMLElement;
    expect(result.textContent?.trim()).toBe('Won · B+R');
    expect(result.classList.contains('kz-game-row-result--won')).toBe(true);

    setEntry(entry({ won: false, result: 'W+4.5' }));
    result = fixture.nativeElement.querySelector('.kz-game-row-result') as HTMLElement;
    expect(result.textContent?.trim()).toBe('Lost · W+4.5');
    expect(result.classList.contains('kz-game-row-result--lost')).toBe(true);
  });

  it('suppresses the divider above the first row of a section via noDividerAbove', () => {
    setEntry(entry(), true);
    const el = fixture.nativeElement.querySelector('.kz-game-row') as HTMLElement;
    expect(el.classList.contains('kz-game-row--no-divider')).toBe(true);
  });

  it("shows the user's stone colour in the thumbnail badge", () => {
    setEntry(entry({ userSign: 1 }));
    expect(fixture.nativeElement.querySelector('.kz-game-row-stone--white')).toBeNull();

    setEntry(entry({ userSign: -1 }));
    expect(fixture.nativeElement.querySelector('.kz-game-row-stone--white')).toBeTruthy();
  });

  it('goes pending, dims, drops the link, hides the ⋮ menu, and shows "Deleting…" once the player confirms deleting a done game', () => {
    setEntry(entry({ status: 'done' }));
    confirmAction();
    fixture.detectChanges();

    expect(gameHistory.resignCalls).toEqual(['game-1']);
    expect(fixture.nativeElement.querySelector('.kz-game-row--pending')).toBeTruthy();
    expect(link()).toBeNull();
    expect(fixture.nativeElement.querySelector('.kz-game-menu-trigger')).toBeNull();
    expect(fixture.nativeElement.querySelector('.kz-game-row-result')).toBeNull();
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
    expect(fixture.nativeElement.querySelector('.kz-game-menu-trigger')).toBeTruthy();
  });
});
