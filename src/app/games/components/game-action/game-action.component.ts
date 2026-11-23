import { Component, computed, inject, input, output } from '@angular/core';
import { TelegramService } from '../../../core/telegram.service';
import type { GameStatus } from '../../game-list-entry';

interface ActionCopy {
  label: string;
  ariaLabel: string;
  icon: 'cancel' | 'delete';
  popupTitle: string;
  popupMessage: string;
  destructiveLabel: string;
}

/**
 * The row's Cancel/Delete button (HANDOFF-update.md section 1). Purely
 * presentation + the Telegram confirmation popup — it knows nothing about
 * networking or the row's pending/removed lifecycle, that's GameRow's job.
 * Opens the popup through TelegramService.showPopup, so it still works
 * outside Telegram, in a browser or in tests (spy on the service there).
 */
@Component({
  selector: 'kz-game-action',
  templateUrl: './game-action.component.html',
  styleUrl: './game-action.component.scss',
})
export class GameActionComponent {
  private readonly telegram = inject(TelegramService);

  readonly status = input.required<GameStatus>();
  readonly opponentName = input.required<string>();

  /** Fires once the player taps the popup's destructive button. */
  readonly confirmed = output<void>();

  readonly copy = computed<ActionCopy>(() => {
    const opponent = this.opponentName();

    switch (this.status()) {
      case 'running':
        return {
          label: 'Cancel',
          ariaLabel: `Cancel the analysis of your game vs ${opponent}`,
          icon: 'cancel',
          popupTitle: 'Cancel this analysis?',
          popupMessage: `KataGo stops analyzing your game vs ${opponent}, and the game leaves your list.`,
          destructiveLabel: 'Cancel analysis',
        };
      case 'waiting':
        return {
          label: 'Cancel',
          ariaLabel: `Cancel the analysis of your game vs ${opponent}`,
          icon: 'cancel',
          popupTitle: 'Cancel this analysis?',
          popupMessage: `Your game vs ${opponent} leaves the analysis queue and your list.`,
          destructiveLabel: 'Cancel analysis',
        };
      case 'done':
        return {
          label: 'Delete',
          ariaLabel: `Delete your game vs ${opponent}`,
          icon: 'delete',
          popupTitle: 'Delete this game?',
          popupMessage: `Your game vs ${opponent} and its analysis will be removed from Kaizen.`,
          destructiveLabel: 'Delete game',
        };
    }
  });

  onTap(): void {
    const copy = this.copy();
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
