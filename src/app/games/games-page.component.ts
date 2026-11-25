import { Component, computed, inject, signal } from '@angular/core';
import { GameHistoryService } from '../data/game-history.service';
import { SgfParserService } from '../sgf/sgf-parser.service';
import { TelegramService } from '../core/telegram.service';
import { PaperBackgroundComponent } from '../shared/paper-background/paper-background.component';
import { SeigaihaFillComponent } from '../shared/seigaiha-fill/seigaiha-fill.component';
import { GameRowComponent } from './components/game-row/game-row.component';
import { DailyPracticeButtonComponent } from '../practice/components/daily-practice-button/daily-practice-button.component';
import { StreakChipComponent } from '../shared/streak-chip/streak-chip.component';
import { deriveGameListEntry, type GameListEntry } from './game-list-entry';
import { isToday, isYesterday } from './game-list-format';

export type ServerFilter = 'all' | 'OGS' | 'DGS';
type Screen = 'loading' | 'ready' | 'error';

@Component({
  selector: 'kz-games-page',
  imports: [PaperBackgroundComponent, SeigaihaFillComponent, GameRowComponent, DailyPracticeButtonComponent, StreakChipComponent],
  templateUrl: './games-page.component.html',
  styleUrl: './games-page.component.scss',
})
export class GamesPageComponent {
  private readonly gameHistory = inject(GameHistoryService);
  private readonly sgfParser = inject(SgfParserService);
  private readonly telegram = inject(TelegramService);

  readonly screen = signal<Screen>('loading');
  private readonly entries = signal<GameListEntry[]>([]);
  readonly filter = signal<ServerFilter>('all');

  readonly counts = computed(() => {
    const all = this.entries();
    return {
      all: all.length,
      OGS: all.filter((e) => e.server === 'OGS').length,
      DGS: all.filter((e) => e.server === 'DGS').length,
    };
  });

  private readonly filteredEntries = computed(() => {
    const filter = this.filter();
    const all = this.entries();
    return filter === 'all' ? all : all.filter((e) => e.server === filter);
  });

  readonly groups = computed(() => {
    const entries = this.filteredEntries();
    return {
      today: entries.filter((e) => isToday(e.date)),
      yesterday: entries.filter((e) => isYesterday(e.date)),
      earlier: entries.filter((e) => !isToday(e.date) && !isYesterday(e.date)),
    };
  });

  readonly isEmpty = computed(() => this.filteredEntries().length === 0);

  /** HANDOFF-games-refinement.md section 7: distinct copy for "no games ever" vs. "none for this filter". */
  readonly emptyCopy = computed(() => {
    const filter = this.filter();
    if (this.entries().length > 0) {
      if (filter === 'DGS') return { title: 'No DGS games', body: 'Games you export from DGS will appear here.' };
      if (filter === 'OGS') return { title: 'No OGS games', body: 'Games you export from OGS will appear here.' };
    }
    return { title: 'No games yet', body: 'Games you export to Kaizen from OGS or DGS will appear here.' };
  });

  constructor() {
    // GamesPage is root (HANDOFF.md section 4): Telegram's own header shows
    // Close only — no BackButton here, unlike ExercisePage.
    this.telegram.hideBackButton(() => {});
    this.loadGames();
  }

  setFilter(filter: ServerFilter): void {
    this.filter.set(filter);
  }

  retry(): void {
    this.loadGames();
  }

  /** GameRow's (removed) output: its cancel/delete request was confirmed by the backend — drop it from the list, counts recompute automatically. */
  onRowRemoved(gameId: string): void {
    this.entries.update((entries) => entries.filter((e) => e.id !== gameId));
  }

  private loadGames(): void {
    this.screen.set('loading');

    this.gameHistory.listGames().subscribe({
      next: (dtos) => {
        this.entries.set(dtos.map((dto) => deriveGameListEntry(dto, this.sgfParser)));
        this.screen.set('ready');
      },
      error: () => this.screen.set('error'),
    });
  }
}
