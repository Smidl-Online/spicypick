import { db } from '../db/index.js';
import { users, scenarios } from '../db/schema.js';
import { eq, and, isNotNull, isNull, ne, or } from 'drizzle-orm';
import { sendBulkPushNotifications } from '../services/pushNotifications.js';

export async function sendDailyNotification() {
  const today = new Date().toISOString().split('T')[0];

  // Check if there's a published scenario for today
  const scenario = await db.query.scenarios.findFirst({
    where: and(
      eq(scenarios.publishDate, today),
      eq(scenarios.status, 'published'),
    ),
  });

  if (!scenario) {
    console.log('[CRON] No published scenario for today, skipping daily notification');
    return;
  }

  // Find users with push tokens who haven't voted today
  const eligibleUsers = await db.query.users.findMany({
    where: and(
      isNotNull(users.pushToken),
      or(isNull(users.lastPlayedAt), ne(users.lastPlayedAt, today)),
    ),
  });

  console.log(`[CRON] Sending daily notification to ${eligibleUsers.length} users`);

  if (eligibleUsers.length === 0) return;

  const messages = eligibleUsers.map((user) => ({
      pushToken: user.pushToken!,
      title: '🌶️ New scenario is here!',
      body: scenario.title,
      data: { type: 'daily_scenario', scenarioId: scenario.id } as Record<string, unknown>,
    }));

  const sent = await sendBulkPushNotifications(messages);
  console.log(`[CRON] Sent ${sent}/${messages.length} daily notifications`);
}
