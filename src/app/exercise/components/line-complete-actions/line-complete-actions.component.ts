import { Component, input, output } from '@angular/core';

/**
 * Daily Practice's "Exercise Complete" actions (handoff section 6, replacing
 * ExerciseActionsComponent's 'correct' kind for daily mode): Try another
 * line / Go deeper, then the primary Next exercise / Finish practice button
 * nearest the thumb.
 */
@Component({
  selector: 'kz-line-complete-actions',
  templateUrl: './line-complete-actions.component.html',
  styleUrl: './line-complete-actions.component.scss',
})
export class LineCompleteActionsComponent {
  readonly isLastExercise = input(false);
  /** Shown but disabled at 40% opacity once KataGo's stored analysis is exhausted — never hidden (handoff section 6: "users learn the action exists, and the message says why it's off"). */
  readonly goDeeperEnabled = input(true);

  readonly tryAnotherLine = output<void>();
  readonly goDeeper = output<void>();
  readonly next = output<void>();
}
