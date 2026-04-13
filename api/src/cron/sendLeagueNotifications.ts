import { db } from '../db/index.js';
import { leagueMembers, leagues, users } from '../db/schema.js';
import { eq, and, isNotNull, inArray } from 'drizzle-orm';
import { sendBulkPushNotifications } from '../services/pushNotifications.js';
import { leaguePromotion, leagueDemotion, leagueChampion, t } from '../i18n/notifications.js';

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

  const leagueIds = lastWeekLeagues.map((l) => l.id);

  const allMembers = await db.query.leagueMembers.findMany({
    where: inArray(leagueMembers.leagueId, leagueIds),
  });

  const userIds = [...new Set(allMembers.map((m) => m.userId))];
  const usersWithTokens = await db.query.users.findMany({
    where: and(inArray(users.id, userIds), isNotNull(users.pushToken)),
  });
  const userMap = new Map(usersWithTokens.map((u) => [u.id, u]));

  for (const member of allMembers) {
    const user = userMap.get(member.userId);
    if (!user?.pushToken) continue;

    const locale = user.locale || 'en';

    if (member.promoted) {
      const { title, body } = t(leaguePromotion, locale);
      messages.push({
        pushToken: user.pushToken,
        title,
        body,
        data: { type: 'league_update' },
      });
    } else if (member.demoted) {
      const { title, body } = t(leagueDemotion, locale);
      messages.push({
        pushToken: user.pushToken,
        title,
        body,
        data: { type: 'league_update' },
      });
    } else if (member.finalRank === 1) {
      const { title, body } = t(leagueChampion, locale);
      messages.push({
        pushToken: user.pushToken,
        title,
        body,
        data: { type: 'league_update' },
      });
    }
  }

  if (messages.length === 0) {
    console.log('[CRON] No league notifications to send');
    return;
  }

  const sent = await sendBulkPushNotifications(messages);
  console.log(`[CRON] Sent ${sent}/${messages.length} league notifications`);
}
