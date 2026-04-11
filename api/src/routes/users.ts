import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, votes, scenarios } from '../db/schema.js';
import { eq, desc, and, sql, count } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { AppEnv } from '../types.js';

const userRoutes = new Hono<AppEnv>();

const updateProfileSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  locale: z.string().max(5).optional(),
  timezone: z.string().max(50).optional(),
});

// GET /api/users/me
userRoutes.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId');

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return c.json({ error: 'User not found' }, 404);

  const [voteCount] = await db.select({ count: count() }).from(votes).where(eq(votes.userId, userId));

  return c.json({
    id: user.id,
    email: user.email,
    username: user.username,
    avatarUrl: user.avatarUrl,
    xp: user.xp,
    level: user.level,
    currentStreak: user.currentStreak,
    longestStreak: user.longestStreak,
    streakFreezes: user.streakFreezes,
    lastPlayedAt: user.lastPlayedAt,
    isPremium: user.isPremium,
    premiumUntil: user.premiumUntil,
    locale: user.locale,
    timezone: user.timezone,
    totalVotes: voteCount.count,
    createdAt: user.createdAt,
  });
});

// PATCH /api/users/me
userRoutes.patch('/me', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.username !== undefined) {
    // Check uniqueness
    const existing = await db.query.users.findFirst({
      where: and(eq(users.username, parsed.data.username)),
    });
    if (existing && existing.id !== userId) {
      return c.json({ error: 'Username already taken' }, 409);
    }
    updates.username = parsed.data.username;
  }
  if (parsed.data.avatarUrl !== undefined) updates.avatarUrl = parsed.data.avatarUrl;
  if (parsed.data.locale !== undefined) updates.locale = parsed.data.locale;
  if (parsed.data.timezone !== undefined) updates.timezone = parsed.data.timezone;

  await db.update(users).set(updates).where(eq(users.id, userId));

  return c.json({ message: 'Profile updated' });
});

// GET /api/users/me/history
userRoutes.get('/me/history', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = (page - 1) * limit;

  const userVotes = await db.query.votes.findMany({
    where: eq(votes.userId, userId),
    orderBy: [desc(votes.votedAt)],
    limit,
    offset,
    with: {
      scenario: true,
    },
  });

  return c.json({
    history: userVotes.map((v) => ({
      scenarioId: v.scenarioId,
      scenarioTitle: v.scenario.title,
      category: v.scenario.category,
      verdict: v.verdict,
      xpEarned: v.xpEarned,
      votedAt: v.votedAt,
      communityStats: {
        total: v.scenario.totalVotes,
        guilty: v.scenario.votesGuilty,
        notGuilty: v.scenario.votesNotGuilty,
        complicated: v.scenario.votesComplicated,
        bothWrong: v.scenario.votesBothWrong,
      },
    })),
    page,
    limit,
  });
});

// POST /api/users/me/streak-freeze
userRoutes.post('/me/streak-freeze', authMiddleware, async (c) => {
  const userId = c.get('userId');

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return c.json({ error: 'User not found' }, 404);

  if (user.streakFreezes <= 0) {
    return c.json({ error: 'No streak freezes available' }, 400);
  }

  await db.update(users).set({
    streakFreezes: user.streakFreezes - 1,
    lastPlayedAt: new Date().toISOString().split('T')[0],
    updatedAt: new Date(),
  }).where(eq(users.id, userId));

  return c.json({
    message: 'Streak freeze used',
    remainingFreezes: user.streakFreezes - 1,
    currentStreak: user.currentStreak,
  });
});

// PUT /api/users/me/push-token
userRoutes.put('/me/push-token', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const { token } = await c.req.json();

  if (!token || typeof token !== 'string') {
    return c.json({ error: 'Push token required' }, 400);
  }

  await db.update(users).set({
    pushToken: token,
    updatedAt: new Date(),
  }).where(eq(users.id, userId));

  return c.json({ message: 'Push token saved' });
});

export default userRoutes;
