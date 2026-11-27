import { Component, computed, input } from '@angular/core';
import { todayIso } from '../../data/practice-exercise-picker';

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface StrippedDay {
  practiced: boolean;
  isToday: boolean;
  weekdayLetter: string;
  weekdayName: string;
}

/**
 * The last 7 days as stones on a Kaya strip (handoff v5-1-kaizen-daily-practice
 * section 8) — oldest on the left, today on the right with the vermilion
 * last-move dot. A past day not practiced is a plain empty intersection
 * (open question 3: a "no exercises that day" mark is left unresolved,
 * rendered the same way for now); today specifically, when not yet
 * practiced, gets its own dashed-circle nudge instead (DailyStreak state).
 */
@Component({
  selector: 'kz-streak-strip',
  templateUrl: './streak-strip.component.html',
  styleUrl: './streak-strip.component.scss',
})
export class StreakStripComponent {
  /** Oldest-first, 7 entries, the last one being today — same shape StreakInfo.last7Days returns. */
  readonly days = input.required<boolean[]>();
  readonly date = input<string>();

  readonly strippedDays = computed<StrippedDay[]>(() => {
    const practiced = this.days();
    const today = new Date(`${this.date() ?? todayIso()}T00:00:00Z`).getUTCDay();
    return practiced.map((wasPracticed, index) => {
      const offsetFromToday = practiced.length - 1 - index;
      const weekday = (((today - offsetFromToday) % 7) + 7) % 7;
      return {
        practiced: wasPracticed,
        isToday: offsetFromToday === 0,
        weekdayLetter: WEEKDAY_LETTERS[weekday],
        weekdayName: WEEKDAY_NAMES[weekday],
      };
    });
  });

  readonly ariaLabel = computed(() => {
    const parts = this.strippedDays().map((day) => {
      const label = day.isToday ? 'today' : day.weekdayName;
      // Today, not yet practiced, reads as "not finished yet" (handoff v5-1
      // section 8) — a plain "missed" would wrongly suggest the day is over.
      const status = day.practiced ? 'practised' : day.isToday ? 'not finished yet' : 'missed';
      return `${label} ${status}`;
    });
    return `Last 7 days: ${parts.join(', ')}.`;
  });
}
