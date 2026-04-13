import { db } from '../db/index.js';
import { users, scenarios } from '../db/schema.js';
import { eq, and, isNotNull, isNull, ne, or, inArray } from 'drizzle-orm';
import { sendBulkPushNotifications } from '../services/pushNotifications.js';
import { dailyScenario, t } from '../i18n/notifications.js';
import { getTimezonesForHour, todayInTimezone } from './timezoneUtils.js';

const TARGET_HOUR = 9; // 9:00 local time

export async function sendDailyNotification() {
  const now = new Date();
  const matchingTimezones = getTimezonesForHour(TARGET_HOUR, now);

  if (matchingTimezones.length === 0) {
    console.log(`[CRON] No timezones at ${TARGET_HOUR}:00 right now, skipping daily notification`);
    return;
  }

  console.log(`[CRON] Daily notification: timezones at ${TARGET_HOUR}:00 — ${matchingTimezones.join(', ')}`);

  // Use UTC date to find the published scenario (scenarios are published globally at midnight UTC)
  const todayUtc = now.toISOString().split('T')[0];
  const scenario = await db.query.scenarios.findFirst({
    where: and(
      eq(scenarios.publishDate, todayUtc),
      eq(scenarios.status, 'published'),
    ),
  });

  if (!scenario) {
    console.log('[CRON] No published scenario for today, skipping daily notification');
    return;
  }

  // Find users whose timezone matches + have push token + haven't played today (in their local time)
  const eligibleUsers = await db.query.users.findMany({
    where: and(
      isNotNull(users.pushToken),
      inArray(users.timezone, matchingTimezones),
    ),
  });

  // Filter out users who already played today in their local timezone
  const notYetPlayed = eligibleUsers.filter((user) => {
    if (!user.lastPlayedAt) return true;
    const userToday = todayInTimezone(user.timezone);
    return user.lastPlayedAt !== userToday;
  });

  console.log(`[CRON] Sending daily notification to ${notYetPlayed.length} users (of ${eligibleUsers.length} in matching TZs)`);

  if (notYetPlayed.length === 0) return;

  const messages = notYetPlayed.map((user) => {
    const { title, body } = t(dailyScenario, user.locale);
    return {
      pushToken: user.pushToken!,
      title,
      body,
      data: { type: 'daily_scenario', scenarioId: scenario.id } as Record<string, unknown>,
    };
  });

  const sent = await sendBulkPushNotifications(messages);
  console.log(`[CRON] Sent ${sent}/${messages.length} daily notifications`);
}
