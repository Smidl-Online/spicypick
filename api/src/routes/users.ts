import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, votes, scenarios, predictions, moralProfiles, demographicStats } from '../db/schema.js';
import { eq, desc, and, sql, count } from 'drizzle-orm';
import { MIN_VOTES, recalculateMoralProfile } from '../services/moralProfileCalculator.js';
import { isValidBirthYear, isValidCountry, isValidGender, recomputeUserDemographicStats, removeUserDemographicStats } from '../services/demographics.js';

import { authMiddleware } from '../middleware/auth.js';
import { AppEnv } from '../types.js';
import { VALID_TIMEZONES } from '../cron/timezoneUtils.js';

const userRoutes = new Hono<AppEnv>();

const updateProfileSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  locale: z.string().max(5).optional(),
  timezone: z.string().max(50).refine(
    (tz) => VALID_TIMEZONES.has(tz),
    { message: 'Invalid IANA timezone' },
  ).optional(),
  birthYear: z.number().int().refine(isValidBirthYear, { message: 'Invalid birth year' }).optional().nullable(),
  country: z.string().length(2).refine(isValidCountry, { message: 'Invalid ISO 3166-1 alpha-2 country code' }).optional().nullable(),
  gender: z.enum(['male', 'female', 'non_binary', 'prefer_not_to_say']).optional().nullable(),
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
    birthYear: user.birthYear,
    country: user.country,
    gender: user.gender,
    totalVotes: voteCount.count,
    createdAt: user.createdAt,
  });
});

// PATCH /api/users/me
userRoutes.patch('/me', authMiddleware, async (c) => {
  const userId = c.get('userId');
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

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
  if (parsed.data.birthYear !== undefined) updates.birthYear = parsed.data.birthYear;
  if (parsed.data.country !== undefined) updates.country = parsed.data.country;
  if (parsed.data.gender !== undefined) updates.gender = parsed.data.gender;

  // If demographics changed, recompute aggregated stats
  const demographicsChanged = parsed.data.birthYear !== undefined
    || parsed.data.country !== undefined
    || parsed.data.gender !== undefined;

  let oldDemographics: { birthYear: number | null; country: string | null; gender: string | null } | null = null;
  if (demographicsChanged) {
    const currentUser = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (currentUser) {
      oldDemographics = {
        birthYear: currentUser.birthYear,
        country: currentUser.country,
        gender: currentUser.gender,
      };
    }
  }

  await db.update(users).set(updates).where(eq(users.id, userId));

  // Async recompute demographic stats (fire and forget)
  if (demographicsChanged && oldDemographics) {
    const newDemographics = {
      birthYear: parsed.data.birthYear !== undefined ? parsed.data.birthYear : oldDemographics.birthYear,
      country: parsed.data.country !== undefined ? parsed.data.country : oldDemographics.country,
      gender: parsed.data.gender !== undefined ? parsed.data.gender : oldDemographics.gender,
    };
    recomputeUserDemographicStats(userId, oldDemographics, newDemographics)
      .catch(err => console.error('Demographic stats recompute failed:', err));
  }

  return c.json({ message: 'Profile updated' });
});

// GET /api/users/me/history
userRoutes.get('/me/history', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const parsedPage = parseInt(c.req.query('page') || '1');
  const page = Math.max(Number.isFinite(parsedPage) ? parsedPage : 1, 1);
  const rawLimit = parseInt(c.req.query('limit') || '20');
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 20, 1), 50);
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

  // Atomic decrement with guard to prevent race condition (double-spend)
  const result = await db.update(users).set({
    streakFreezes: sql`${users.streakFreezes} - 1`,
    lastPlayedAt: new Date().toISOString().split('T')[0],
    updatedAt: new Date(),
  }).where(and(eq(users.id, userId), sql`${users.streakFreezes} > 0`)).returning({ remaining: users.streakFreezes });

  if (result.length === 0) {
    return c.json({ error: 'No streak freezes available' }, 400);
  }

  return c.json({
    message: 'Streak freeze used',
    remainingFreezes: result[0].remaining,
    currentStreak: user.currentStreak,
  });
});

// GET /api/users/me/prediction-stats
userRoutes.get('/me/prediction-stats', authMiddleware, async (c) => {
  const userId = c.get('userId');

  const [totalResult] = await db.select({ count: count() })
    .from(predictions)
    .where(eq(predictions.userId, userId));

  const [correctResult] = await db.select({ count: count() })
    .from(predictions)
    .where(and(eq(predictions.userId, userId), eq(predictions.isCorrect, true)));

  const [xpResult] = await db.select({ total: sql<number>`COALESCE(SUM(${predictions.xpEarned}), 0)::int` })
    .from(predictions)
    .where(eq(predictions.userId, userId));

  const totalPredictions = totalResult.count;
  const correctPredictions = correctResult.count;
  const accuracy = totalPredictions > 0 ? Math.round((correctPredictions / totalPredictions) * 100) : 0;

  return c.json({
    totalPredictions,
    correctPredictions,
    accuracy,
    totalXpFromPredictions: xpResult.total,
  });
});

// GET /api/users/me/moral-profile
userRoutes.get('/me/moral-profile', authMiddleware, async (c) => {
  const userId = c.get('userId');

  const profile = await db.query.moralProfiles.findFirst({
    where: eq(moralProfiles.userId, userId),
  });

  const [voteCount] = await db.select({ count: count() }).from(votes).where(eq(votes.userId, userId));

  const hasEnoughVotes = voteCount.count >= MIN_VOTES;

  if (!hasEnoughVotes) {
    return c.json({
      profile: null,
      totalVotesAnalyzed: 0,
      minimumVotesRequired: MIN_VOTES,
      isReady: false,
      lastCalculatedAt: null,
      votesUntilReady: Math.max(0, MIN_VOTES - voteCount.count),
    });
  }

  // If no profile exists or profile is stale (fewer votes analyzed than current count),
  // synchronously recalculate before responding
  const isStale = profile && profile.totalVotesAnalyzed < voteCount.count;
  if (!profile || isStale) {
    try {
      await recalculateMoralProfile(userId);
      const recalculated = await db.query.moralProfiles.findFirst({
        where: eq(moralProfiles.userId, userId),
      });
      if (recalculated) {
        return c.json({
          profile: {
            forgiving: recalculated.forgiving,
            pragmatic: recalculated.pragmatic,
            empathetic: recalculated.empathetic,
            confrontational: recalculated.confrontational,
            majorityAligned: recalculated.majorityAligned,
            consistent: recalculated.consistent,
          },
          totalVotesAnalyzed: recalculated.totalVotesAnalyzed,
          minimumVotesRequired: MIN_VOTES,
          isReady: true,
          lastCalculatedAt: recalculated.lastCalculatedAt,
          votesUntilReady: 0,
        });
      }
    } catch (err) {
      console.error('Moral profile recalc failed:', err);
      // If we had a stale profile, return it rather than failing
      if (profile) {
        return c.json({
          profile: {
            forgiving: profile.forgiving,
            pragmatic: profile.pragmatic,
            empathetic: profile.empathetic,
            confrontational: profile.confrontational,
            majorityAligned: profile.majorityAligned,
            consistent: profile.consistent,
          },
          totalVotesAnalyzed: profile.totalVotesAnalyzed,
          minimumVotesRequired: MIN_VOTES,
          isReady: true,
          lastCalculatedAt: profile.lastCalculatedAt,
          votesUntilReady: 0,
        });
      }
    }
    // No profile existed and recalc failed — indicate pending state
    return c.json({
      profile: null,
      totalVotesAnalyzed: 0,
      minimumVotesRequired: MIN_VOTES,
      isReady: false,
      lastCalculatedAt: null,
      votesUntilReady: 0,
      retryable: true,
    });
  }

  return c.json({
    profile: {
      forgiving: profile.forgiving,
      pragmatic: profile.pragmatic,
      empathetic: profile.empathetic,
      confrontational: profile.confrontational,
      majorityAligned: profile.majorityAligned,
      consistent: profile.consistent,
    },
    totalVotesAnalyzed: profile.totalVotesAnalyzed,
    minimumVotesRequired: MIN_VOTES,
    isReady: true,
    lastCalculatedAt: profile.lastCalculatedAt,
    votesUntilReady: 0,
  });
});

// DELETE /api/users/me/demographics — GDPR: delete demographic data without deleting account
userRoutes.delete('/me/demographics', authMiddleware, async (c) => {
  const userId = c.get('userId');

  // Read current demographics before deletion to decrement aggregated stats
  const currentUser = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const oldDemographics = currentUser
    ? { birthYear: currentUser.birthYear, country: currentUser.country, gender: currentUser.gender }
    : null;

  await db.update(users).set({
    birthYear: null,
    country: null,
    gender: null,
    updatedAt: new Date(),
  }).where(eq(users.id, userId));

  // Async decrement aggregated demographic stats (fire and forget)
  if (oldDemographics && (oldDemographics.birthYear || oldDemographics.country || oldDemographics.gender)) {
    removeUserDemographicStats(userId, oldDemographics)
      .catch(err => console.error('Demographic stats removal failed:', err));
  }

  return c.json({ message: 'Demographic data deleted' });
});

// PUT /api/users/me/push-token
userRoutes.put('/me/push-token', authMiddleware, async (c) => {
  const userId = c.get('userId');
  let reqBody: unknown;
  try { reqBody = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  const { token } = reqBody as { token?: string };

  if (!token || typeof token !== 'string') {
    return c.json({ error: 'Push token required' }, 400);
  }

  await db.update(users).set({
    pushToken: token,
    updatedAt: new Date(),
  }).where(eq(users.id, userId));

  return c.json({ message: 'Push token saved' });
});

// GET /api/users/me/notification-preferences
userRoutes.get('/me/notification-preferences', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return c.json({ error: 'User not found' }, 404);

  return c.json({
    daily: user.notifDaily,
    streak: user.notifStreak,
    league: user.notifLeague,
    challenges: user.notifChallenges,
    achievements: user.notifAchievements,
  });
});

// PATCH /api/users/me/notification-preferences
const notifPrefsSchema = z.object({
  daily: z.boolean().optional(),
  streak: z.boolean().optional(),
  league: z.boolean().optional(),
  challenges: z.boolean().optional(),
  achievements: z.boolean().optional(),
});

userRoutes.patch('/me/notification-preferences', authMiddleware, async (c) => {
  const userId = c.get('userId');
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const parsed = notifPrefsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.daily !== undefined) updates.notifDaily = parsed.data.daily;
  if (parsed.data.streak !== undefined) updates.notifStreak = parsed.data.streak;
  if (parsed.data.league !== undefined) updates.notifLeague = parsed.data.league;
  if (parsed.data.challenges !== undefined) updates.notifChallenges = parsed.data.challenges;
  if (parsed.data.achievements !== undefined) updates.notifAchievements = parsed.data.achievements;

  await db.update(users).set(updates).where(eq(users.id, userId));

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });

  return c.json({
    daily: user!.notifDaily,
    streak: user!.notifStreak,
    league: user!.notifLeague,
    challenges: user!.notifChallenges,
    achievements: user!.notifAchievements,
  });
});

export default userRoutes;
