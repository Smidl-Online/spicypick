import { Hono } from 'hono';
import { db } from '../db/index.js';
import { leagues, leagueMembers, users } from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { AppEnv } from '../types.js';

const leagueRoutes = new Hono<AppEnv>();

// GET /api/leagues/current
leagueRoutes.get('/current', authMiddleware, async (c) => {
  const userId = c.get('userId');

  // Find user's current league membership
  const membership = await db.query.leagueMembers.findFirst({
    where: eq(leagueMembers.userId, userId),
    orderBy: [desc(leagueMembers.id)],
    with: {
      league: true,
    },
  });

  if (!membership) {
    return c.json({ league: null, message: 'Not in a league yet. Vote to join!' });
  }

  // Get all members of this league
  const members = await db.query.leagueMembers.findMany({
    where: eq(leagueMembers.leagueId, membership.leagueId),
    orderBy: [desc(leagueMembers.weeklyXp)],
    with: {
      user: true,
    },
  });

  const leaderboard = members.map((m, idx) => ({
    rank: idx + 1,
    userId: m.userId,
    username: m.user.username,
    avatarUrl: m.user.avatarUrl,
    weeklyXp: m.weeklyXp,
    isPromotionZone: idx < 10,
    isDemotionZone: idx >= members.length - 5,
    isCurrentUser: m.userId === userId,
  }));

  return c.json({
    league: {
      id: membership.league.id,
      tier: membership.league.tier,
      weekStart: membership.league.weekStart,
      weekEnd: membership.league.weekEnd,
    },
    userRank: leaderboard.findIndex((l) => l.isCurrentUser) + 1,
    userWeeklyXp: membership.weeklyXp,
    leaderboard,
  });
});

// GET /api/leagues/history
leagueRoutes.get('/history', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = (page - 1) * limit;

  const memberships = await db.query.leagueMembers.findMany({
    where: eq(leagueMembers.userId, userId),
    orderBy: [desc(leagueMembers.id)],
    limit,
    offset,
    with: {
      league: true,
    },
  });

  return c.json({
    history: memberships.map((m) => ({
      leagueId: m.leagueId,
      tier: m.league.tier,
      weekStart: m.league.weekStart,
      weekEnd: m.league.weekEnd,
      weeklyXp: m.weeklyXp,
      finalRank: m.finalRank,
      promoted: m.promoted,
      demoted: m.demoted,
    })),
    page,
    limit,
  });
});

export default leagueRoutes;
