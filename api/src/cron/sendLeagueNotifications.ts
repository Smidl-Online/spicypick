import { db } from '../db/index.js';
import { leagueMembers, leagues, users } from '../db/schema.js';
import { eq, and, isNotNull } from 'drizzle-orm';
import { sendBulkPushNotifications } from '../services/pushNotifications.js';

export async function sendLeagueNotifications() {
  // Find leagues that ended last week
  const today = new Date();
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7) - 7);
  const lastMondayStr = lastMonday.toISOString().split('T')[0];

  const lastWeekLeagues = await db.query.leagues.findMany({
    where: eq(leagues.weekStart, lastMondayStr),
  });

  if (lastWeekLeagues.length === 0) {
    console.log('[CRON] No leagues from last week to notify about');
    return;
  }

  const messages: Array<{
    pushToken: string;
    title: string;
    body: string;
    data: Record<string, unknown>;
  }> = [];

  for (const league of lastWeekLeagues) {
    const members = await db.query.leagueMembers.findMany({
      where: eq(leagueMembers.leagueId, league.id),
    });

    for (const member of members) {
      const user = await db.query.users.findFirst({
        where: and(eq(users.id, member.userId), isNotNull(users.pushToken)),
      });

      if (!user?.pushToken) continue;

      if (member.promoted) {
        messages.push({
          pushToken: user.pushToken,
          title: '🏆 League Promotion!',
          body: `Congratulations! You've been promoted in the league!`,
          data: { type: 'league_update' },
        });
      } else if (member.demoted) {
        messages.push({
          pushToken: user.pushToken,
          title: '📉 League Update',
          body: `You've been moved down a tier. Keep voting to climb back!`,
          data: { type: 'league_update' },
        });
      } else if (member.finalRank === 1) {
        messages.push({
          pushToken: user.pushToken,
          title: '👑 League Champion!',
          body: `You finished #1 in your league! Amazing!`,
          data: { type: 'league_update' },
        });
      }
    }
  }

  if (messages.length === 0) {
    console.log('[CRON] No league notifications to send');
    return;
  }

  const sent = await sendBulkPushNotifications(messages);
  console.log(`[CRON] Sent ${sent}/${messages.length} league notifications`);
}
