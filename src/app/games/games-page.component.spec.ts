import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { GamesPageComponent } from './games-page.component';
import { GameHistoryService } from '../data/game-history.service';
import type { GameHistoryDto } from '../data/game-history.model';

// Computed relative to the real current date, not hardcoded — isToday() (used
// by GamesPageComponent's grouping) compares a DT[] value against `new Date()`
// at the moment the test actually runs, so a fixed calendar date would make
// the "Today" section wrongly empty (or "Earlier" wrongly full) on any other day.
function isoDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

const DONE_SGF = `(;FF[4]SZ[19]PB[the_user]PW[kitsune77]BR[4k]WR[3k]PC[OGS]DT[${isoDate(0)}]RE[B+R]PL[B];B[qd];W[cp];B[nq](;B[je];W[ie])(;B[ro];W[qo]))`;

const DONE_SGF_DGS_YESTERDAY = `(;FF[4]SZ[19]PB[the_user]PW[stormcrow]BR[6k]WR[5k]PC[DGS: dragongoserver.net]DT[${isoDate(1)}]RE[W+4.5]PL[B];B[dd];W[pp](;B[je];W[ie])(;B[ro];W[qo]))`;

function makeDto(overrides: Partial<GameHistoryDto> = {}): GameHistoryDto {
  return {
    id: 'g1',
    correlationId: 'c1',
    openingAnalysed: null,
    middlegameAnalysed: null,
    endgameAnalysed: null,
    blackPlayer: null,
    whitePlayer: null,
    gameRank: null,
    ...overrides,
  };
}

class StubGameHistoryService extends GameHistoryService {
  games$ = new Subject<GameHistoryDto[]>();

  override getGameHistory() {
    return of(makeDto());
  }

  override listGames() {
    return this.games$.asObservable();
  }
}

describe('GamesPageComponent', () => {
  let fixture: ComponentFixture<GamesPageComponent>;
  let stub: StubGameHistoryService;

  beforeEach(() => {
    delete window.Telegram;
    TestBed.configureTestingModule({
      imports: [GamesPageComponent],
      providers: [provideRouter([]), { provide: GameHistoryService, useClass: StubGameHistoryService }],
    });
    stub = TestBed.inject(GameHistoryService) as unknown as StubGameHistoryService;
  });

  function create(): ComponentFixture<GamesPageComponent> {
    fixture = TestBed.createComponent(GamesPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('shows a loading state before the list arrives', () => {
    create();
    expect(fixture.nativeElement.textContent).toContain('Loading your games');
  });

  it('groups rows into Today/Earlier and renders both sections', () => {
    create();
    stub.games$.next([
      makeDto({ id: 'today-game', middlegameAnalysed: DONE_SGF }),
      makeDto({ id: 'yesterday-game', middlegameAnalysed: DONE_SGF_DGS_YESTERDAY }),
    ]);
    fixture.detectChanges();

    const sectionTitles = Array.from(fixture.nativeElement.querySelectorAll('.kz-games-section-title')).map(
      (el) => (el as HTMLElement).textContent
    );
    expect(sectionTitles).toEqual(['Today', 'Earlier']);
    expect(fixture.nativeElement.querySelectorAll('kz-game-row').length).toBe(2);
  });

  it('computes per-server counts across all fetched games, independent of the active filter', () => {
    create();
    stub.games$.next([
      makeDto({ id: 'g-ogs', middlegameAnalysed: DONE_SGF }),
      makeDto({ id: 'g-dgs', middlegameAnalysed: DONE_SGF_DGS_YESTERDAY }),
    ]);
    fixture.detectChanges();

    expect(fixture.componentInstance.counts()).toEqual({ all: 2, OGS: 1, DGS: 1 });
  });

  it('filters the visible rows by server when a filter tab is clicked', () => {
    create();
    stub.games$.next([
      makeDto({ id: 'g-ogs', middlegameAnalysed: DONE_SGF }),
      makeDto({ id: 'g-dgs', middlegameAnalysed: DONE_SGF_DGS_YESTERDAY }),
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('kz-game-row').length).toBe(2);

    const ogsTab = Array.from(fixture.nativeElement.querySelectorAll('.kz-games-filter')).find((b) =>
      (b as HTMLElement).textContent?.includes('OGS')
    ) as HTMLElement;
    ogsTab.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('kz-game-row').length).toBe(1);
    expect(ogsTab.classList.contains('kz-games-filter--active')).toBe(true);
    expect(ogsTab.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows an empty state when the list comes back empty', () => {
    create();
    stub.games$.next([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No analyzed games yet');
  });

  it('shows a failed state with a working retry button', () => {
    create();
    stub.games$.error(new Error('network down'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("Couldn't load your games");

    stub.games$ = new Subject<GameHistoryDto[]>();
    const retryBtn = fixture.nativeElement.querySelector('.kz-games-retry') as HTMLButtonElement;
    retryBtn.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading your games');

    stub.games$.next([makeDto({ id: 'recovered', middlegameAnalysed: DONE_SGF })]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('kz-game-row').length).toBe(1);
  });
});
