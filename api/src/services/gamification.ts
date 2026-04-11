import { db } from '../db/index.js';
import { users, votes, scenarios, achievements, userAchievements, leagueMembers, scenarioSubmissions, challenges } from '../db/schema.js';
import { eq, sql, and, count } from 'drizzle-orm';

export function xpForLevel(level: number): number {
  return Math.floor(50 * Math.pow(level, 1.5));
}

export function calculateLevel(totalXp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= totalXp) {
    level++;
  }
  return level;
}

export function calculateVoteXp(currentStreak: number, majorityMatch: boolean): number {
  let xp = 10;
  if (majorityMatch) xp += 5;
  const streakBonus = Math.min(currentStreak * 2, 60);
  xp += streakBonus;
  return xp;
}

export const LEAGUE_TIERS = [
  'bronze', 'silver', 'gold', 'platinum', 'diamond',
  'obsidian', 'ruby', 'emerald', 'sapphire', 'amethyst',
] as const;

export type LeagueTier = typeof LEAGUE_TIERS[number];

export async function checkAchievements(userId: string): Promise<string[]> {
  const unlocked: string[] = [];

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return unlocked;

  const existing = await db.query.userAchievements.findMany({
    where: eq(userAchievements.userId, userId),
  });
  const existingIds = new Set(existing.map((a) => a.achievementId));

  const allAchievements = await db.query.achievements.findMany();
  const achievementMap = new Map(allAchievements.map((a) => [a.id, a]));

  const tryUnlock = async (id: string) => {
    if (existingIds.has(id) || !achievementMap.has(id)) return;
    await db.insert(userAchievements).values({ userId, achievementId: id }).onConflictDoNothing();
    const achievement = achievementMap.get(id)!;
    if (achievement.xpReward > 0) {
      await db.update(users).set({
        xp: sql`${users.xp} + ${achievement.xpReward}`,
      }).where(eq(users.id, userId));
    }
    unlocked.push(id);
  };

  // First vote
  const [voteCount] = await db.select({ count: count() }).from(votes).where(eq(votes.userId, userId));
  if (voteCount.count >= 1) await tryUnlock('first_vote');

  // Streak achievements
  if (user.currentStreak >= 7) await tryUnlock('streak_7');
  if (user.currentStreak >= 30) await tryUnlock('streak_30');
  if (user.currentStreak >= 365) await tryUnlock('streak_365');

  // Contrarian & consensus
  const userVotes = await db.query.votes.findMany({ where: eq(votes.userId, userId) });
  let contrarianCount = 0;
  let consensusCount = 0;
  for (const v of userVotes) {
    const scenario = await db.query.scenarios.findFirst({ where: eq(scenarios.id, v.scenarioId) });
    if (!scenario || scenario.totalVotes === 0) continue;
    const verdictCounts: Record<string, number> = {
      guilty: scenario.votesGuilty,
      not_guilty: scenario.votesNotGuilty,
      complicated: scenario.votesComplicated,
      both_wrong: scenario.votesBothWrong,
    };
    const maxVotes = Math.max(...Object.values(verdictCounts));
    const userVerdictVotes = verdictCounts[v.verdict] || 0;
    if (userVerdictVotes < maxVotes) contrarianCount++;
    if (userVerdictVotes / scenario.totalVotes >= 0.7) consensusCount++;
  }
  if (contrarianCount >= 10) await tryUnlock('contrarian_10');
  if (consensusCount >= 10) await tryUnlock('consensus_10');

  // League achievements
  const memberEntries = await db.query.leagueMembers.findMany({
    where: eq(leagueMembers.userId, userId),
    with: { league: true },
  });
  for (const m of memberEntries) {
    if (m.league.tier === 'diamond') await tryUnlock('league_diamond');
    if (m.league.tier === 'amethyst') await tryUnlock('league_amethyst');
  }

  // Submission approved
  const approvedSubs = await db.query.scenarioSubmissions.findMany({
    where: and(
      eq(scenarioSubmissions.userId, userId),
      eq(scenarioSubmissions.status, 'approved'),
    ),
  });
  if (approvedSubs.length > 0) await tryUnlock('submit_approved');

  // Challenge wins
  const wonChallenges = await db.select({ count: count() }).from(challenges).where(
    and(
      eq(challenges.challengerId, userId),
      eq(challenges.status, 'completed'),
    ),
  );
  if (wonChallenges[0].count >= 5) await tryUnlock('challenge_win_5');

  // Update user level
  const updatedUser = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (updatedUser) {
    const newLevel = calculateLevel(updatedUser.xp);
    if (newLevel !== updatedUser.level) {
      await db.update(users).set({ level: newLevel }).where(eq(users.id, userId));
    }
  }

  return unlocked;
}
