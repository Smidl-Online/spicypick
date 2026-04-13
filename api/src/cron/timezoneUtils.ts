/**
 * Timezone utilities for scheduling notifications at user-local times.
 *
 * Strategy: cron runs every hour. For each target local hour we compute
 * which IANA timezones currently show that hour, then filter users by
 * their stored `timezone` value.
 */

/** Full IANA timezone list from the runtime — covers all user timezones. */
const ALL_TIMEZONES: string[] = [...Intl.supportedValuesOf('timeZone'), 'UTC'];

/** Set for O(1) timezone validation. */
export const VALID_TIMEZONES = new Set(ALL_TIMEZONES);

/**
 * Returns a list of IANA timezone strings where the current local hour
 * matches `targetHour` (0-23).
 *
 * Handles DST automatically via Intl.DateTimeFormat.
 */
export function getTimezonesForHour(targetHour: number, now?: Date): string[] {
  const d = now ?? new Date();
  const matching: string[] = [];

  for (const tz of ALL_TIMEZONES) {
    try {
      const hourStr = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric',
        hour12: false,
      }).format(d);
      // Intl returns "0"–"23" (or "24" at midnight in some locales)
      const localHour = parseInt(hourStr, 10) % 24;
      if (localHour === targetHour) {
        matching.push(tz);
      }
    } catch {
      // Skip invalid timezone
    }
  }

  return matching;
}

/**
 * Returns today's date string (YYYY-MM-DD) in a given timezone.
 */
export function todayInTimezone(tz: string, now?: Date): string {
  const d = now ?? new Date();
  try {
    return d.toLocaleDateString('en-CA', { timeZone: tz });
  } catch {
    return d.toISOString().split('T')[0];
  }
}

/**
 * Checks whether the current day-of-week in the given timezone is `targetDay`
 * (0 = Sunday, 1 = Monday, ..., 6 = Saturday).
 */
export function isDayOfWeekInTimezone(targetDay: number, tz: string, now?: Date): boolean {
  const d = now ?? new Date();
  try {
    const dayStr = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
    }).format(d);
    const dayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    return dayMap[dayStr] === targetDay;
  } catch {
    return false;
  }
}
