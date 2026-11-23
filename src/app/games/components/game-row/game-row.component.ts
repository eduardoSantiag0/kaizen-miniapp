import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameHistoryService } from '../../../data/game-history.service';
import type { GameListEntry } from '../../game-list-entry';
import { formatRelativeDate } from '../../game-list-format';
import { GameActionComponent } from '../game-action/game-action.component';

/**
 * One row of GamesPage's list. A 'done' row with a mistake to study is a real
 * link to its exercise, via an <a> stretched over the whole row (HANDOFF-update.md
 * section 1) — not wrapping the row, since the row also holds the Cancel/Delete
 * action button and a button can't sit inside a link. 'running'/'waiting' rows,
 * and 'done' rows with nothing flagged, get no link at all.
 */
@Component({
  selector: 'kz-game-row',
  imports: [RouterLink, GameActionComponent],
  templateUrl: './game-row.component.html',
  styleUrl: './game-row.component.scss',
})
export class GameRowComponent {
  private readonly gameHistory = inject(GameHistoryService);

  readonly entry = input.required<GameListEntry>();
  /** True for the first row of its section (Today/Earlier) — that row gets no divider above it, the section boundary already supplies one. */
  readonly noDividerAbove = input(false);

  /** Emits this row's id once the backend has confirmed the cancel/delete — GamesPage drops it from the list. */
  readonly removed = output<string>();

  /** True while a confirmed cancel/delete request is in flight. */
  readonly pending = signal(false);

  /** A 'done' row with nothing flagged has no exercise to open — same as 'running'/'waiting', it's inert. Also inert while pending (HANDOFF-update.md: "the row stops being a link"). */
  readonly tappable = computed(
    () => !this.pending() && this.entry().status === 'done' && this.entry().mistakePhases.length > 0,
  );

  readonly statusText = computed(() => {
    const e = this.entry();
    if (this.pending()) return e.status === 'done' ? 'Deleting…' : 'Cancelling…';

    switch (e.status) {
      case 'done':
        // Copy pending the user's sign-off, same as GamesPage's empty/loading/failed states.
        if (e.mistakePhases.length === 0) return 'No concerns found';
        if (e.mistakePhases.length === 1) return `Biggest mistake · move ${e.mistakeMoveNumber}`;
        return `${e.mistakePhases.length} mistakes to study · ${e.mistakePhases.join(', ')}`;
      case 'running':
        return 'KataGo is analyzing…';
      case 'waiting':
        return 'Queued for analysis';
    }
  });

  /** GameAction's (confirmed) handler: the player tapped the popup's destructive button. */
  onActionConfirmed(): void {
    const id = this.entry().id;
    this.pending.set(true);
    this.gameHistory.resignGame(id).subscribe({
      next: () => this.removed.emit(id),
      // "If the request fails, put the row back as it was" (HANDOFF-update.md section 1).
      error: () => this.pending.set(false),
    });
  }

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
