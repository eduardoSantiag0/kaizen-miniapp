import { Component, input, output } from '@angular/core';
import type { ActionsCopy } from '../../exercise-copy';

@Component({
  selector: 'kz-exercise-actions',
  templateUrl: './exercise-actions.component.html',
  styleUrl: './exercise-actions.component.scss',
})
export class ExerciseActionsComponent {
  readonly actions = input.required<ActionsCopy>();
  /** Label for the 'done' phase's secondary button — "Back to games" from the menu, swappable for a future session mode. */
  readonly correctSecondaryLabel = input('Back to games');

  readonly play = output<void>();
  readonly cancel = output<void>();
  readonly tryAgain = output<void>();
  readonly playAgain = output<void>();
  readonly backToGames = output<void>();
  /** The 'done' phase's secondary button specifically (separate from the plain error-screen backToGames above). */
  readonly doneSecondary = output<void>();
}
