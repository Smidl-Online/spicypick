import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { and, gt, ne, isNotNull } from 'drizzle-orm';
import { sendBulkPushNotifications } from '../services/pushNotifications.js';

export async function sendStreakWarnings() {
  const today = new Date().toISOString().split('T')[0];

  // Find users with active streak who haven't played today and have push tokens
  const atRiskUsers = await db.query.users.findMany({
    where: and(
      gt(users.currentStreak, 0),
      ne(users.lastPlayedAt, today),
      isNotNull(users.pushToken),
    ),
  });

  console.log(`[CRON] Found ${atRiskUsers.length} users with at-risk streaks`);

  if (atRiskUsers.length === 0) return;

  const messages = atRiskUsers
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
