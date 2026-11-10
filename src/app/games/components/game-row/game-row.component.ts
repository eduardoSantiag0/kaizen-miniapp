import { Component, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { GameListEntry } from '../../game-list-entry';
import { formatRelativeDate } from '../../game-list-format';

/**
 * One row of GamesPage's list. A 'done' row is a real link to its exercise;
 * 'running'/'waiting' rows are inert (HANDOFF.md section 4) — no nested
 * interactive elements inside either, so the whole row is one <a> or one <div>.
 */
@Component({
  selector: 'kz-game-row',
  imports: [RouterLink, NgTemplateOutlet],
  templateUrl: './game-row.component.html',
  styleUrl: './game-row.component.scss',
})
export class GameRowComponent {
  readonly entry = input.required<GameListEntry>();
  /** True for the first row of its section (Today/Earlier) — that row gets no divider above it, the section boundary already supplies one. */
  readonly noDividerAbove = input(false);

  /** A 'done' row with nothing flagged has no exercise to open — same as 'running'/'waiting', it's inert. */
  readonly tappable = computed(() => this.entry().status === 'done' && this.entry().mistakeMoveNumber !== null);

  readonly statusText = computed(() => {
    const e = this.entry();
    switch (e.status) {
      case 'done':
        // Copy pending the user's sign-off, same as GamesPage's empty/loading/failed states.
        return e.mistakeMoveNumber !== null ? `Biggest mistake · move ${e.mistakeMoveNumber}` : 'No concerns found';
      case 'running':
        return 'KataGo is analyzing…';
      case 'waiting':
        return 'Queued for analysis';
    }
  });

  readonly metaText = computed(() => {
    const e = this.entry();
    const parts = [`${e.boardSize}×${e.boardSize}`, e.server, e.moves ? `${e.moves} moves` : '', formatRelativeDate(e.date)];
    return parts.filter(Boolean).join(' · ');
  });

  readonly outcomeLabel = computed(() => {
    const won = this.entry().won;
    return won === true ? 'Won' : won === false ? 'Lost' : '';
  });

  readonly accessibleName = computed(() => {
    const e = this.entry();
    return `${e.opponentName}, ${this.outcomeLabel().toLowerCase()} ${e.result}, ${e.boardSize} by ${e.boardSize}, ${this.statusText()}`;
  });
}
