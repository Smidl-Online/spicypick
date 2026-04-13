import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { and, gt, isNotNull, inArray } from 'drizzle-orm';
import { sendBulkPushNotifications } from '../services/pushNotifications.js';
import { getTimezonesForHour, todayInTimezone } from './timezoneUtils.js';

const TARGET_HOUR = 20; // 20:00 local time

export async function sendStreakWarnings() {
  const now = new Date();
  const matchingTimezones = getTimezonesForHour(TARGET_HOUR, now);

  if (matchingTimezones.length === 0) {
    console.log(`[CRON] No timezones at ${TARGET_HOUR}:00 right now, skipping streak warnings`);
    return;
  }

  console.log(`[CRON] Streak warnings: timezones at ${TARGET_HOUR}:00 — ${matchingTimezones.join(', ')}`);

  // Find users with active streak, push token, and matching timezone
  const atRiskUsers = await db.query.users.findMany({
    where: and(
      gt(users.currentStreak, 0),
      isNotNull(users.pushToken),
      inArray(users.timezone, matchingTimezones),
    ),
  });

  // Filter to those who haven't played today in their local timezone
  const notYetPlayed = atRiskUsers.filter((user) => {
    if (!user.lastPlayedAt) return true;
    const userToday = todayInTimezone(user.timezone);
    return user.lastPlayedAt !== userToday;
  });

  console.log(`[CRON] Found ${notYetPlayed.length} users with at-risk streaks (of ${atRiskUsers.length} in matching TZs)`);

  if (notYetPlayed.length === 0) return;

  const messages = notYetPlayed
    .filter((u) => u.pushToken)
    .map((user) => ({
      pushToken: user.pushToken!,
      title: '🔥 Streak v ohrožení!',
      body: `Tvůj ${user.currentStreak}-denní streak je v ohrožení! Zbývá pár hodin.`,
      data: { type: 'streak_warning' } as Record<string, unknown>,
    }));

  const sent = await sendBulkPushNotifications(messages);
  console.log(`[CRON] Sent ${sent}/${messages.length} streak warnings`);
}
