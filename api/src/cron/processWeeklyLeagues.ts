import { db } from '../db/index.js';
import { leagues, leagueMembers, users } from '../db/schema.js';
import { eq, desc, sql, isNull } from 'drizzle-orm';
import { LEAGUE_TIERS, type LeagueTier } from '../services/gamification.js';

const LEAGUE_SIZE = 30;
const PROMOTE_COUNT = 10;
const DEMOTE_COUNT = 5;

export async function processWeeklyLeagues() {
  // 1. Get all active leagues (current week)
  const today = new Date();
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7) - 7);
  const lastMondayStr = lastMonday.toISOString().split('T')[0];

  const activeLeagues = await db.query.leagues.findMany({
    where: eq(leagues.weekStart, lastMondayStr),
  });

  const promotedUsers: string[] = [];
  const demotedUsers: string[] = [];
  const stayUsers: Map<string, string> = new Map(); // userId -> current tier

  for (const league of activeLeagues) {
    // Get members ordered by weekly XP
    const members = await db.query.leagueMembers.findMany({
      where: eq(leagueMembers.leagueId, league.id),
      orderBy: [desc(leagueMembers.weeklyXp)],
    });

    const tierIndex = LEAGUE_TIERS.indexOf(league.tier as LeagueTier);

    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      const rank = i + 1;

      // Update final rank
      await db.update(leagueMembers).set({ finalRank: rank }).where(eq(leagueMembers.id, member.id));

      if (rank <= PROMOTE_COUNT && tierIndex < LEAGUE_TIERS.length - 1) {
        // Promote
        await db.update(leagueMembers).set({ promoted: true }).where(eq(leagueMembers.id, member.id));
        const newTier = LEAGUE_TIERS[tierIndex + 1];
        stayUsers.set(member.userId, newTier);
        promotedUsers.push(member.userId);
      } else if (rank > members.length - DEMOTE_COUNT && tierIndex > 0) {
        // Demote
        await db.update(leagueMembers).set({ demoted: true }).where(eq(leagueMembers.id, member.id));
        const newTier = LEAGUE_TIERS[tierIndex - 1];
        stayUsers.set(member.userId, newTier);
        demotedUsers.push(member.userId);
      } else {
        // Stay
        stayUsers.set(member.userId, league.tier);
      }
    }
  }

  // 2. Find new users who aren't in any league
  const allUsers = await db.select({ id: users.id }).from(users);
  for (const user of allUsers) {
    if (!stayUsers.has(user.id)) {
      stayUsers.set(user.id, 'bronze'); // New users start in bronze
    }
  }

  // 3. Create new leagues for this week
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const thisMondayStr = thisMonday.toISOString().split('T')[0];
  const nextSunday = new Date(thisMonday);
  nextSunday.setDate(thisMonday.getDate() + 6);
  const nextSundayStr = nextSunday.toISOString().split('T')[0];

  // Group users by tier
  const tierGroups = new Map<string, string[]>();
  for (const [userId, tier] of stayUsers) {
    if (!tierGroups.has(tier)) tierGroups.set(tier, []);
    tierGroups.get(tier)!.push(userId);
  }

  // Create leagues of LEAGUE_SIZE
  for (const [tier, userIds] of tierGroups) {
    // Fisher-Yates shuffle for fair distribution
    const shuffled = [...userIds];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    for (let i = 0; i < shuffled.length; i += LEAGUE_SIZE) {
      const chunk = shuffled.slice(i, i + LEAGUE_SIZE);

      const [league] = await db.insert(leagues).values({
        tier,
        weekStart: thisMondayStr,
        weekEnd: nextSundayStr,
      }).returning();

      for (const userId of chunk) {
        await db.insert(leagueMembers).values({
          leagueId: league.id,
          userId,
          weeklyXp: 0,
        });
      }
    }
  }

  console.log(`[CRON] Leagues processed: ${promotedUsers.length} promoted, ${demotedUsers.length} demoted`);
}
