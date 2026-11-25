import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { GamesPageComponent } from './games-page.component';
import { GameHistoryService } from '../data/game-history.service';
import { PracticeService } from '../data/practice.service';
import { TelegramService } from '../core/telegram.service';
import type { GameHistoryDto } from '../data/game-history.model';

/** The Daily Practice card (RF03.2) is incidental to these tests — an empty session is enough to satisfy it. */
class StubPracticeService extends PracticeService {
  override getTodaySession() {
    return of(null);
  }

  override startTodaySession() {
    return of({ date: '2026-01-01', exercises: [], completed: false });
  }

  override startNewRound() {
    return this.startTodaySession();
  }

  override startRandomPractice() {
    return this.startTodaySession();
  }

  override recordResult() {
    return of(undefined);
  }

  override getPreferences() {
    return of({ topVariants: 3, continuationDepth: 6, exerciseSource: 'own' as const, exerciseCount: 5 });
  }

  override setPreferences() {
    return of(undefined);
  }

  override saveProgress() {
    return of(undefined);
  }

  override getStreak() {
    return of({ currentStreak: 0, last7Days: [false, false, false, false, false, false, false] });
  }
}

// Computed relative to the real current date, not hardcoded — isToday() (used
// by GamesPageComponent's grouping) compares a DT[] value against `new Date()`
// at the moment the test actually runs, so a fixed calendar date would make
// the "Today" section wrongly empty (or "Earlier" wrongly full) on any other day.
// Local calendar date, not `.toISOString()`'s UTC one — see
// practice-exercise-picker.ts's todayIso() for why that flips to the wrong
// day for a window around local midnight in negative-UTC-offset timezones.
function isoDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

  override resignGame() {
    return of(undefined);
  }
}

describe('GamesPageComponent', () => {
  let fixture: ComponentFixture<GamesPageComponent>;
  let stub: StubGameHistoryService;

  beforeEach(() => {
    delete window.Telegram;
    TestBed.configureTestingModule({
      imports: [GamesPageComponent],
      providers: [
        provideRouter([]),
        { provide: GameHistoryService, useClass: StubGameHistoryService },
        { provide: PracticeService, useClass: StubPracticeService },
      ],
    });
    stub = TestBed.inject(GameHistoryService) as unknown as StubGameHistoryService;
  });

  function create(): ComponentFixture<GamesPageComponent> {
    fixture = TestBed.createComponent(GamesPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('shows a loading skeleton (no counts) before the list arrives', () => {
    create();
    expect(fixture.nativeElement.querySelector('[role="status"][aria-label="Loading games"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.kz-games-skeleton-row').length).toBe(3);
    expect(fixture.nativeElement.querySelector('.kz-games-filter-count')).toBeNull();
  });

  it('groups rows into Today/Yesterday and renders both sections', () => {
    create();
    stub.games$.next([
      makeDto({ id: 'today-game', middlegameAnalysed: DONE_SGF }),
      makeDto({ id: 'yesterday-game', middlegameAnalysed: DONE_SGF_DGS_YESTERDAY }),
    ]);
    fixture.detectChanges();

    const sectionTitles = Array.from(fixture.nativeElement.querySelectorAll('.kz-games-section-title')).map(
      (el) => (el as HTMLElement).textContent
    );
    expect(sectionTitles).toEqual(['Today', 'Yesterday']);
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

    expect(fixture.nativeElement.textContent).toContain('No games yet');
  });

  it('shows filter-specific empty copy when a filter has no games, distinct from the all-empty state', () => {
    create();
    stub.games$.next([makeDto({ id: 'g-ogs', middlegameAnalysed: DONE_SGF })]);
    fixture.detectChanges();

    const dgsTab = Array.from(fixture.nativeElement.querySelectorAll('.kz-games-filter')).find((b) =>
      (b as HTMLElement).textContent?.includes('DGS'),
    ) as HTMLElement;
    dgsTab.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No DGS games');
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
    expect(fixture.nativeElement.querySelector('[role="status"][aria-label="Loading games"]')).toBeTruthy();

    stub.games$.next([makeDto({ id: 'recovered', middlegameAnalysed: DONE_SGF })]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('kz-game-row').length).toBe(1);
  });

  it('drops a row and updates counts once its delete is confirmed (HANDOFF-update.md section 1)', () => {
    create();
    stub.games$.next([
      makeDto({ id: 'g-ogs', middlegameAnalysed: DONE_SGF }),
      makeDto({ id: 'g-dgs', middlegameAnalysed: DONE_SGF_DGS_YESTERDAY }),
    ]);
    fixture.detectChanges();
    expect(fixture.componentInstance.counts()).toEqual({ all: 2, OGS: 1, DGS: 1 });

    const telegram = TestBed.inject(TelegramService);
    spyOn(telegram, 'showPopup').and.callFake((_params, callback) => callback('confirm'));
    (fixture.nativeElement.querySelector('.kz-game-menu-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.kz-game-menu-item') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('kz-game-row').length).toBe(1);
    expect(fixture.componentInstance.counts()).toEqual({ all: 1, OGS: 0, DGS: 1 });
  });
});
