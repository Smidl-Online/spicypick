/**
 * Timezone utilities for scheduling notifications at user-local times.
 *
 * Strategy: cron runs every hour. For each target local hour we compute
 * which IANA timezones currently show that hour, then filter users by
 * their stored `timezone` value.
 */

const COMMON_TIMEZONES = [
  'Pacific/Midway',       // UTC-11
  'Pacific/Honolulu',     // UTC-10
  'America/Anchorage',    // UTC-9
  'America/Los_Angeles',  // UTC-8 / -7
  'America/Denver',       // UTC-7 / -6
  'America/Chicago',      // UTC-6 / -5
  'America/New_York',     // UTC-5 / -4
  'America/Halifax',      // UTC-4 / -3
  'America/Sao_Paulo',    // UTC-3 / -2
  'Atlantic/South_Georgia', // UTC-2
  'Atlantic/Azores',      // UTC-1 / 0
  'UTC',
  'Europe/London',        // UTC+0 / +1
  'Europe/Prague',        // UTC+1 / +2
  'Europe/Helsinki',      // UTC+2 / +3
  'Europe/Moscow',        // UTC+3
  'Asia/Dubai',           // UTC+4
  'Asia/Karachi',         // UTC+5
  'Asia/Kolkata',         // UTC+5:30
  'Asia/Dhaka',           // UTC+6
  'Asia/Bangkok',         // UTC+7
  'Asia/Shanghai',        // UTC+8
  'Asia/Tokyo',           // UTC+9
  'Australia/Adelaide',   // UTC+9:30 / +10:30
  'Australia/Sydney',     // UTC+10 / +11
  'Pacific/Noumea',       // UTC+11
  'Pacific/Auckland',     // UTC+12 / +13
  'Pacific/Tongatapu',    // UTC+13
];

/**
 * Returns a list of IANA timezone strings where the current local hour
 * matches `targetHour` (0-23).
 *
 * Handles DST automatically via Intl.DateTimeFormat.
 */
export function getTimezonesForHour(targetHour: number, now?: Date): string[] {
  const d = now ?? new Date();
  const matching: string[] = [];

  for (const tz of COMMON_TIMEZONES) {
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
