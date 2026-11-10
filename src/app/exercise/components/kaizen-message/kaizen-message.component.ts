import { Component, input } from '@angular/core';
import type { MessageTone } from '../../exercise-copy';

@Component({
  selector: 'kz-kaizen-message',
  templateUrl: './kaizen-message.component.html',
  styleUrl: './kaizen-message.component.scss',
})
export class KaizenMessageComponent {
  readonly title = input.required<string>();
  readonly body = input.required<string>();
  readonly tone = input<MessageTone>('neutral');
  readonly emphasized = input(false);
  /**
   * True only on a fresh line completion ('done'). Shows a small localized
   * checkmark badge + soft glow on the avatar — the reward moment, scoped to
   * this one element rather than a screen-wide effect. Driven by a plain
   * boolean rather than a bump counter: ExercisePage's `celebrate` goes
   * false→true fresh on every completion (any path back into 'done' passes
   * through 'play' first), so the badge's @if naturally remounts and replays
   * its entrance animation each time without extra plumbing.
   */
  readonly celebrate = input(false);
}
