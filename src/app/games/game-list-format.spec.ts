import { formatRelativeDate, isToday } from './game-list-format';

describe('game-list-format', () => {
  const now = new Date(2026, 10, 10); // 2026-11-10, local time, no time-of-day component

  describe('formatRelativeDate', () => {
    it('returns "" for an absent date', () => {
      expect(formatRelativeDate('', now)).toBe('');
    });

    it('labels the same day "Today"', () => {
      expect(formatRelativeDate('2026-11-10', now)).toBe('Today');
    });

    it('labels the previous day "Yesterday"', () => {
      expect(formatRelativeDate('2026-11-09', now)).toBe('Yesterday');
    });

    it('formats an older date within the same year without the year', () => {
      expect(formatRelativeDate('2026-10-03', now)).toBe('Oct 3');
    });

    it('formats a date from a previous year with the year included', () => {
      expect(formatRelativeDate('2025-10-03', now)).toBe('Oct 3, 2025');
    });

    it('falls back to the raw string for an unparsable date', () => {
      expect(formatRelativeDate('not-a-date', now)).toBe('not-a-date');
    });
  });

  describe('isToday', () => {
    it('is false for an absent date', () => {
      expect(isToday('', now)).toBe(false);
    });

    it('is true only for the exact same day', () => {
      expect(isToday('2026-11-10', now)).toBe(true);
      expect(isToday('2026-11-09', now)).toBe(false);
    });
  });
});
