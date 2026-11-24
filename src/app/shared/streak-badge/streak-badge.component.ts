import { Component, input } from '@angular/core';

/**
 * "● N days in a row" (handoff v4-3-kaizen-daily-practice section 4/8) — a
 * 10px black stone and the plain count. The caller hides it at 0 and while
 * loading (handoff: "It is hidden at 0 and while loading"); this component
 * always renders given a positive count.
 */
@Component({
  selector: 'kz-streak-badge',
  templateUrl: './streak-badge.component.html',
  styleUrl: './streak-badge.component.scss',
})
export class StreakBadgeComponent {
  readonly days = input.required<number>();
}
