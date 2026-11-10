/** SGF DT[] values are plain "YYYY-MM-DD" dates with no time-of-day — grouping/labels below only ever compare whole days. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Parses a plain "YYYY-MM-DD" string as a LOCAL calendar date. `new
 * Date("YYYY-MM-DD")` parses that form as UTC midnight (per the ES spec),
 * which then reads back one day earlier through local getters in any
 * negative-UTC-offset timezone — exactly the kind of off-by-one that stays
 * invisible if you only test at UTC. Returns null for anything that isn't
 * this exact shape (SGF DT[] is plain, and anything else isn't ours to parse).
 */
function parseLocalDate(dateStr: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return isNaN(date.getTime()) ? null : date;
}

/** '' for an absent/unparsable date, so callers can treat it like any other missing field. */
export function formatRelativeDate(dateStr: string, now: Date = new Date()): string {
  if (!dateStr) return '';
  const date = parseLocalDate(dateStr);
  if (!date) return dateStr;

  const diffDays = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

/**
 * Groups rows into "Today"/"Earlier" per HANDOFF.md section 4. The source
 * date is the game's own SGF DT[] (when it was played), not an "analysed at"
 * timestamp — the DTO carries nothing else to group by, so "Today" here
 * means "played today," which may read oddly for an older game that just
 * finished analysis moments ago. No better field exists to group on.
 */
export function isToday(dateStr: string, now: Date = new Date()): boolean {
  if (!dateStr) return false;
  const date = parseLocalDate(dateStr);
  return date !== null && startOfDay(date).getTime() === startOfDay(now).getTime();
}
