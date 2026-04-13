import { describe, it, expect } from 'vitest';
import {
  getTimezonesForHour,
  todayInTimezone,
  isDayOfWeekInTimezone,
} from '../cron/timezoneUtils.js';

describe('timezoneUtils', () => {
  describe('getTimezonesForHour', () => {
    it('should return timezones where the local hour matches target', () => {
      // At 2026-01-15 09:00 UTC, Europe/Prague is at 10:00 (CET = UTC+1)
      const jan15_09utc = new Date('2026-01-15T09:00:00Z');
      const tzAt10 = getTimezonesForHour(10, jan15_09utc);
      expect(tzAt10).toContain('Europe/Prague');
    });

    it('should return UTC when target matches UTC hour', () => {
      const jan15_14utc = new Date('2026-01-15T14:00:00Z');
      const tzAt14 = getTimezonesForHour(14, jan15_14utc);
      expect(tzAt14).toContain('UTC');
    });

    it('should return empty array for a time with no matching timezones', () => {
      // We pick a very specific time; at minute :30 some half-hour TZs might match
      // but getTimezonesForHour only checks the hour, so this should still work
      const result = getTimezonesForHour(25); // invalid hour
      expect(result).toEqual([]);
    });

    it('should handle DST correctly — summer time', () => {
      // 2026-07-15 09:00 UTC → Europe/Prague is CEST (UTC+2) → local 11:00
      const jul15_09utc = new Date('2026-07-15T09:00:00Z');
      const tzAt11 = getTimezonesForHour(11, jul15_09utc);
      expect(tzAt11).toContain('Europe/Prague');

      // In winter it was at 10, should NOT be in the 10 list in summer
      const tzAt10 = getTimezonesForHour(10, jul15_09utc);
      expect(tzAt10).not.toContain('Europe/Prague');
    });

    it('should include multiple timezones for the same hour', () => {
      const d = new Date('2026-01-15T12:00:00Z');
      const tzAt12 = getTimezonesForHour(12, d);
      // UTC and Europe/London (GMT in January) should both be at 12
      expect(tzAt12).toContain('UTC');
      expect(tzAt12).toContain('Europe/London');
    });
  });

  describe('todayInTimezone', () => {
    it('should return the correct date for a timezone', () => {
      // 2026-01-15 23:00 UTC → in Auckland (UTC+13 in Jan) it's already 2026-01-16
      const jan15_23utc = new Date('2026-01-15T23:00:00Z');
      const auckland = todayInTimezone('Pacific/Auckland', jan15_23utc);
      expect(auckland).toBe('2026-01-16');
    });

    it('should return UTC date for UTC timezone', () => {
      const d = new Date('2026-03-10T05:00:00Z');
      expect(todayInTimezone('UTC', d)).toBe('2026-03-10');
    });

    it('should fallback to UTC for invalid timezone', () => {
      const d = new Date('2026-03-10T05:00:00Z');
      const result = todayInTimezone('Invalid/Timezone', d);
      expect(result).toBe('2026-03-10');
    });
  });

  describe('isDayOfWeekInTimezone', () => {
    it('should return true for Monday in matching timezone', () => {
      // 2026-01-12 is Monday
      const monday = new Date('2026-01-12T12:00:00Z');
      expect(isDayOfWeekInTimezone(1, 'UTC', monday)).toBe(true);
    });

    it('should return false for non-Monday', () => {
      // 2026-01-13 is Tuesday
      const tuesday = new Date('2026-01-13T12:00:00Z');
      expect(isDayOfWeekInTimezone(1, 'UTC', tuesday)).toBe(false);
    });

    it('should handle date boundary — late UTC Sunday can be Monday in far-east TZ', () => {
      // 2026-01-11 is Sunday in UTC at 23:00
      // But in Auckland (UTC+13 in Jan) it's already Monday 2026-01-12 12:00
      const sundayLateUtc = new Date('2026-01-11T23:00:00Z');
      expect(isDayOfWeekInTimezone(0, 'UTC', sundayLateUtc)).toBe(true); // Sunday in UTC
      expect(isDayOfWeekInTimezone(1, 'Pacific/Auckland', sundayLateUtc)).toBe(true); // Monday in NZ
    });
  });
});
