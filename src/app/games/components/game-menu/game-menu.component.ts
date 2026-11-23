import { Component, computed, inject, input, output, signal } from '@angular/core';
import { TelegramService } from '../../../core/telegram.service';
import type { GameStatus } from '../../game-list-entry';

interface MenuCopy {
  label: string;
  icon: 'cancel' | 'delete';
  popupTitle: string;
  popupMessage: string;
  destructiveLabel: string;
}

/**
 * The row's ⋮ menu (HANDOFF-games-refinement.md section 6) — replaces the
 * inline Cancel/Delete button from the 23 Nov update. One destructive
 * menuitem (Delete game / Cancel analysis); tapping it opens the same
 * Telegram confirmation popup as before. Purely presentation + the
 * popover's own open/closed state — GameRow still owns pending/removed.
 */
@Component({
  selector: 'kz-game-menu',
  templateUrl: './game-menu.component.html',
  styleUrl: './game-menu.component.scss',
})
export class GameMenuComponent {
  private readonly telegram = inject(TelegramService);

  readonly status = input.required<GameStatus>();
  readonly opponentName = input.required<string>();

  /** Fires once the player taps the popup's destructive button. */
  readonly confirmed = output<void>();

  /** Whether the ⋮ popover is open. */
  readonly open = signal(false);

  readonly copy = computed<MenuCopy>(() => {
    const opponent = this.opponentName();

    switch (this.status()) {
      case 'running':
        return {
          label: 'Cancel analysis',
          icon: 'cancel',
          popupTitle: 'Cancel this analysis?',
          popupMessage: `KataGo stops analyzing your game vs ${opponent}, and the game leaves your list.`,
          destructiveLabel: 'Cancel analysis',
        };
      case 'waiting':
        return {
          label: 'Cancel analysis',
          icon: 'cancel',
          popupTitle: 'Cancel this analysis?',
          popupMessage: `Your game vs ${opponent} leaves the analysis queue and your list.`,
          destructiveLabel: 'Cancel analysis',
        };
      case 'done':
        return {
          label: 'Delete game',
          icon: 'delete',
          popupTitle: 'Delete this game?',
          popupMessage: `Your game vs ${opponent} and its analysis will be removed from Kaizen.`,
          destructiveLabel: 'Delete game',
        };
    }
  });

  readonly triggerLabel = computed(() => `More actions for the game vs ${this.opponentName()}`);

  toggle(): void {
    this.open.update((v) => !v);
  }

  close(): void {
    this.open.set(false);
  }

  onItemTap(): void {
    const copy = this.copy();
    this.close();
    this.telegram.showPopup(
      {
        title: copy.popupTitle,
        message: copy.popupMessage,
        buttons: [
          { id: 'confirm', type: 'destructive', text: copy.destructiveLabel },
          { id: 'keep', type: 'default', text: 'Keep' },
        ],
      },
      (buttonId) => {
        if (buttonId === 'confirm') this.confirmed.emit();
      },
    );
  }
}
