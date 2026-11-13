import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GameRowComponent } from './game-row.component';
import type { GameListEntry } from '../../game-list-entry';

describe('GameRowComponent', () => {
  let fixture: ComponentFixture<GameRowComponent>;

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

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('renders a "done" row as a real link to its exercise, with the full accessible name', () => {
    setEntry(entry());

    const link = fixture.nativeElement.querySelector('a.kz-game-row') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('aria-label')).toBe('kitsune77, won B+R, 19 by 19, Biggest mistake · move 75');
    expect(link.getAttribute('href')).toContain('/game/game-1');
  });

  it('renders the status line text per status', () => {
    setEntry(entry({ status: 'done', mistakeMoveNumber: 75 }));
    expect(fixture.nativeElement.textContent).toContain('Biggest mistake · move 75');

    setEntry(entry({ status: 'running' }));
    expect(fixture.nativeElement.textContent).toContain('KataGo is analyzing…');

    setEntry(entry({ status: 'waiting' }));
    expect(fixture.nativeElement.textContent).toContain('Queued for analysis');
  });

  it('a "done" row with nothing flagged (mistakeMoveNumber null) shows clean-game copy and is not tappable', () => {
    setEntry(entry({ status: 'done', mistakeMoveNumber: null, mistakePhases: [] }));

    expect(fixture.nativeElement.textContent).toContain('No concerns found');
    expect(fixture.nativeElement.querySelector('a')).toBeNull();
    expect(fixture.nativeElement.querySelector('div.kz-game-row')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.kz-game-row-right--no-chevron')).toBeTruthy();
  });

  it('shows "N mistakes to study" with the phase list when more than one phase has a mistake', () => {
    setEntry(entry({ status: 'done', mistakeMoveNumber: 12, mistakePhases: ['opening', 'middlegame', 'endgame'] }));

    expect(fixture.nativeElement.textContent).toContain('3 mistakes to study · opening, middlegame, endgame');

    const link = fixture.nativeElement.querySelector('a.kz-game-row') as HTMLAnchorElement;
    expect(link).toBeTruthy(); // still a single tap into the game's own exercise collection, same link as before
  });

  it('renders a non-"done" row as a plain, non-tappable div — no nested link', () => {
    setEntry(entry({ status: 'running' }));

    expect(fixture.nativeElement.querySelector('a')).toBeNull();
    expect(fixture.nativeElement.querySelector('div.kz-game-row')).toBeTruthy();
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
});
