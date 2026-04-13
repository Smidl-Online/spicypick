import { db } from '../db/index.js';
import { leagueMembers, leagues, users } from '../db/schema.js';
import { eq, and, isNotNull, inArray } from 'drizzle-orm';
import { sendBulkPushNotifications } from '../services/pushNotifications.js';
import { getTimezonesForHour, isDayOfWeekInTimezone } from './timezoneUtils.js';

const TARGET_HOUR = 10; // 10:00 local time
const TARGET_DAY = 1;   // Monday

export async function sendLeagueNotifications() {
  const now = new Date();
  const matchingTimezones = getTimezonesForHour(TARGET_HOUR, now);

  if (matchingTimezones.length === 0) {
    console.log(`[CRON] No timezones at ${TARGET_HOUR}:00 right now, skipping league notifications`);
    return;
  }

  // Further filter: only timezones where it's also Monday
  const mondayTimezones = matchingTimezones.filter((tz) =>
    isDayOfWeekInTimezone(TARGET_DAY, tz, now),
  );

  if (mondayTimezones.length === 0) {
    console.log(`[CRON] No timezones at Monday ${TARGET_HOUR}:00 right now, skipping league notifications`);
    return;
  }

  console.log(`[CRON] League notifications: timezones at Monday ${TARGET_HOUR}:00 — ${mondayTimezones.join(', ')}`);

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

  const leagueIds = lastWeekLeagues.map((l) => l.id);

  const allMembers = await db.query.leagueMembers.findMany({
    where: inArray(leagueMembers.leagueId, leagueIds),
  });

  const userIds = [...new Set(allMembers.map((m) => m.userId))];

  // Only fetch users in matching Monday timezones with push tokens
  const usersWithTokens = await db.query.users.findMany({
    where: and(
      inArray(users.id, userIds),
      isNotNull(users.pushToken),
      inArray(users.timezone, mondayTimezones),
    ),
  });
  const userMap = new Map(usersWithTokens.map((u) => [u.id, u]));

  const messages: Array<{
    pushToken: string;
    title: string;
    body: string;
    data: Record<string, unknown>;
  }> = [];

  for (const member of allMembers) {
    const user = userMap.get(member.userId);
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

  if (messages.length === 0) {
    console.log('[CRON] No league notifications to send');
    return;
  }

  const sent = await sendBulkPushNotifications(messages);
  console.log(`[CRON] Sent ${sent}/${messages.length} league notifications`);
}
