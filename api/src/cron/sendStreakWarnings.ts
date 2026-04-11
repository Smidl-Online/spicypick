import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { and, gt, ne, isNotNull } from 'drizzle-orm';

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

  for (const user of atRiskUsers) {
    // TODO: Send actual push notification via expo-server-sdk
    // For now, just log
    console.log(`[CRON] Would send streak warning to ${user.username} (streak: ${user.currentStreak})`);

    // In production:
    // await sendPushNotification(user.pushToken, {
    //   title: '🔥 Streak v ohrožení!',
    //   body: `Tvůj ${user.currentStreak}-denní streak je v ohrožení! Zbývá pár hodin.`,
    //   data: { type: 'streak_warning' },
    // });
  }
}
