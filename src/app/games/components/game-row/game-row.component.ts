import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameHistoryService } from '../../../data/game-history.service';
import type { GameListEntry } from '../../game-list-entry';
import { formatRelativeDate } from '../../game-list-format';
import { GameMenuComponent } from '../game-menu/game-menu.component';

/**
 * One row of GamesPage's list. A 'done' row with a mistake to study is a real
 * link to its exercise, via an <a> stretched over the whole row (HANDOFF-update.md
 * section 1) — not wrapping the row, since the row also holds the ⋮ menu
 * button and a button can't sit inside a link. 'running'/'waiting' rows,
 * and 'done' rows with nothing flagged, get no link at all.
 */
@Component({
  selector: 'kz-game-row',
  imports: [RouterLink, GameMenuComponent],
  templateUrl: './game-row.component.html',
  styleUrl: './game-row.component.scss',
})
export class GameRowComponent {
  private readonly gameHistory = inject(GameHistoryService);

  readonly entry = input.required<GameListEntry>();
  /** True for the first row of its section (Today/Yesterday/Earlier) — that row gets no divider above it, the section boundary already supplies one. */
  readonly noDividerAbove = input(false);

  /** Emits this row's id once the backend has confirmed the cancel/delete — GamesPage drops it from the list. */
  readonly removed = output<string>();

  /** True while a confirmed cancel/delete request is in flight. */
  readonly pending = signal(false);

  /** A 'done' row with nothing flagged has no exercise to open — same as 'running'/'waiting', it's inert. Also inert while pending (HANDOFF-update.md: "the row stops being a link"). */
  readonly tappable = computed(
    () => !this.pending() && this.entry().status === 'done' && this.entry().mistakePhases.length > 0,
  );

  readonly resultLabel = computed(() => {
    const won = this.entry().won;
    return won === true ? 'Won' : won === false ? 'Lost' : '';
  });

  /** "Won · B+R" / "Lost · W+4.5" (HANDOFF-games-refinement.md section 4) — only shown for a settled 'done' game, not while pending. */
  readonly resultText = computed(() => {
    const e = this.entry();
    const label = this.resultLabel();
    if (!label) return '';
    return e.result ? `${label} · ${e.result}` : label;
  });

  /** `{server} · {size}×{size} · {time or date}` (HANDOFF-games-refinement.md section 4) — the move count is gone; no `playedAt` timestamp exists yet (section 8/9), so Today/Yesterday rows fall back to that label instead of a real time. */
  readonly metaText = computed(() => {
    const e = this.entry();
    const parts = [e.server, `${e.boardSize}×${e.boardSize}`, formatRelativeDate(e.date)];
    return parts.filter(Boolean).join(' · ');
  });

  /** The row's second line when there's no result to show yet, or nothing to tap into. */
  readonly statusLine = computed(() => {
    if (this.pending()) return this.entry().status === 'done' ? 'Deleting…' : 'Cancelling…';

    switch (this.entry().status) {
      case 'running':
        return '⏱ KataGo is analyzing this game…';
      case 'waiting':
        return '⏱ Waiting for analysis';
      case 'done':
        return this.tappable() ? this.metaText() : 'No mistakes to practice';
    }
  });

  /** GameMenu's (confirmed) handler: the player tapped the popup's destructive button. */
  onActionConfirmed(): void {
    const id = this.entry().id;
    this.pending.set(true);
    this.gameHistory.resignGame(id).subscribe({
      next: () => this.removed.emit(id),
      // "If the request fails, put the row back as it was" (HANDOFF-update.md section 1).
      error: () => this.pending.set(false),
    });
  }

  readonly accessibleName = computed(() => {
    const e = this.entry();
    return `${e.opponentName}, ${this.resultLabel().toLowerCase()} ${e.result}, ${e.boardSize} by ${e.boardSize}, ${this.statusLine()}`;
  });
}
