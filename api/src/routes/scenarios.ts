import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/index.js';
import { scenarios, votes, users, predictions } from '../db/schema.js';
import { eq, sql, and, desc, lte, isNotNull } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { calculateVoteXp, calculateLevel, checkAchievements } from '../services/gamification.js';
import { sendPushNotification } from '../services/pushNotifications.js';
import { AppEnv } from '../types.js';
import { VALID_CATEGORIES } from '../constants.js';
import { analytics } from '../services/analytics.js';

const scenarioRoutes = new Hono<AppEnv>();

const uuidSchema = z.string().uuid();
const VALID_VERDICTS = ['guilty', 'not_guilty', 'complicated', 'both_wrong'] as const;
const verdictSchema = z.object({
  verdict: z.enum(VALID_VERDICTS),
});

function todayDate(timezone?: string): string {
  if (timezone) {
    try {
      return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
    } catch {
      // Invalid timezone — fall back to UTC
    }
  }
  return new Date().toISOString().split('T')[0];
}

// GET /api/scenarios/today
scenarioRoutes.get('/today', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const today = todayDate(user?.timezone ?? undefined);

  const userLocale = user?.locale || 'en';

  let scenario = await db.query.scenarios.findFirst({
    where: and(
      eq(scenarios.publishDate, today),
      eq(scenarios.status, 'published'),
      eq(scenarios.locale, userLocale),
    ),
  });

  // Fallback to English if no scenario for user's locale
  if (!scenario && userLocale !== 'en') {
    scenario = await db.query.scenarios.findFirst({
      where: and(
        eq(scenarios.publishDate, today),
        eq(scenarios.status, 'published'),
        eq(scenarios.locale, 'en'),
      ),
    });
  }

  if (!scenario) {
    return c.json({ scenario: null, message: 'No scenario today yet' });
  }

  // Scenario number = count of published scenarios up to and including today (for user's locale)
  const scenarioLocale = scenario.locale;
  const [{ count: scenarioNumber }] = await db.select({ count: sql<number>`count(*)::int` })
    .from(scenarios)
    .where(and(
      eq(scenarios.status, 'published'),
      lte(scenarios.publishDate, today),
      eq(scenarios.locale, scenarioLocale),
    ));

  // Check if user already voted
  const existingVote = await db.query.votes.findFirst({
    where: and(
      eq(votes.userId, userId),
      eq(votes.scenarioId, scenario.id),
    ),
  });

  // Check if user has a prediction
  const existingPrediction = await db.query.predictions.findFirst({
    where: and(
      eq(predictions.userId, userId),
      eq(predictions.scenarioId, scenario.id),
    ),
  });

  if (existingVote) {
    return c.json({
      scenario: {
        id: scenario.id,
        title: scenario.title,
        body: scenario.body,
        category: scenario.category,
        expertAnalysis: scenario.expertAnalysis,
        publishDate: scenario.publishDate,
        locale: scenario.locale,
        pack: scenario.pack,
      },
      scenarioNumber,
      voted: true,
      userVerdict: existingVote.verdict,
      communityStats: {
        total: scenario.totalVotes,
        guilty: scenario.votesGuilty,
        notGuilty: scenario.votesNotGuilty,
        complicated: scenario.votesComplicated,
        bothWrong: scenario.votesBothWrong,
      },
      prediction: existingPrediction ? {
        predictedVerdict: existingPrediction.predictedVerdict,
        isCorrect: existingPrediction.isCorrect,
        xpEarned: existingPrediction.xpEarned,
      } : null,
    });
  }

  return c.json({
    scenario: {
      id: scenario.id,
      title: scenario.title,
      body: scenario.body,
      category: scenario.category,
      publishDate: scenario.publishDate,
      locale: scenario.locale,
      pack: scenario.pack,
    },
    scenarioNumber,
    voted: false,
    predicted: !!existingPrediction,
    prediction: existingPrediction ? {
      predictedVerdict: existingPrediction.predictedVerdict,
    } : null,
  });
});

// GET /api/scenarios/packs — list available themed packs
scenarioRoutes.get('/packs', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const locale = c.req.query('locale') || user?.locale || 'en';

  let packs = await db.select({
    pack: scenarios.pack,
    count: sql<number>`count(*)::int`,
    categories: sql<string[]>`array_agg(DISTINCT ${scenarios.category})`,
  })
    .from(scenarios)
    .where(and(
      isNotNull(scenarios.pack),
      eq(scenarios.status, 'published'),
      eq(scenarios.locale, locale),
    ))
    .groupBy(scenarios.pack);

  // Fallback to English if no packs for user's locale
  if (packs.length === 0 && locale !== 'en') {
    packs = await db.select({
      pack: scenarios.pack,
      count: sql<number>`count(*)::int`,
      categories: sql<string[]>`array_agg(DISTINCT ${scenarios.category})`,
    })
      .from(scenarios)
      .where(and(
        isNotNull(scenarios.pack),
        eq(scenarios.status, 'published'),
        eq(scenarios.locale, 'en'),
      ))
      .groupBy(scenarios.pack);
  }

  return c.json({
    packs: packs.map((p) => ({
      id: p.pack,
      name: p.pack,
      scenarioCount: p.count,
      categories: p.categories,
    })),
  });
});

// GET /api/scenarios/packs/:packId — get scenarios from a themed pack (premium only)
scenarioRoutes.get('/packs/:packId', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const packId = c.req.param('packId');
  const category = c.req.query('category');
  const parsedPage = parseInt(c.req.query('page') || '1');
  const page = Math.max(Number.isFinite(parsedPage) ? parsedPage : 1, 1);
  const rawLimit = parseInt(c.req.query('limit') || '20');
  const limit = Math.min(Math.max(rawLimit || 20, 1), 50);

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const isPremiumActive = user?.isPremium && (!user.premiumUntil || new Date(user.premiumUntil) > new Date());
  if (!isPremiumActive) {
    return c.json({ error: 'Premium subscription required for themed packs' }, 403);
  }

  const locale = c.req.query('locale') || user?.locale || 'en';
  const offset = (page - 1) * limit;

  const conditions = [
    sql`${scenarios.pack} = ${packId}`,
    eq(scenarios.status, 'published'),
    eq(scenarios.locale, locale),
  ];
  if (category && (VALID_CATEGORIES as readonly string[]).includes(category)) {
    conditions.push(eq(scenarios.category, category));
  }

  let packScenarios = await db.query.scenarios.findMany({
    where: and(...conditions),
    orderBy: [desc(scenarios.publishDate)],
    limit,
    offset,
  });

  // Fallback to English if no scenarios for user's locale in this pack
  if (packScenarios.length === 0 && locale !== 'en' && offset === 0) {
    const enConditions = [
      sql`${scenarios.pack} = ${packId}`,
      eq(scenarios.status, 'published'),
      eq(scenarios.locale, 'en'),
    ];
    if (category && (VALID_CATEGORIES as readonly string[]).includes(category)) {
      enConditions.push(eq(scenarios.category, category));
    }
    packScenarios = await db.query.scenarios.findMany({
      where: and(...enConditions),
      orderBy: [desc(scenarios.publishDate)],
      limit,
      offset,
    });
  }

  return c.json({
    pack: packId,
    scenarios: packScenarios.map((s) => ({
      id: s.id,
      title: s.title,
      category: s.category,
      publishDate: s.publishDate,
      totalVotes: s.totalVotes,
    })),
    page,
    limit,
  });
});

// GET /api/scenarios/archive (premium only) — must be registered BEFORE /:id to avoid being caught by param route
scenarioRoutes.get('/archive/list', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const parsedPage = parseInt(c.req.query('page') || '1');
  const page = Math.max(Number.isFinite(parsedPage) ? parsedPage : 1, 1);
  const rawLimit = parseInt(c.req.query('limit') || '20');
  const limit = Math.min(Math.max(rawLimit || 20, 1), 50);
  const category = c.req.query('category');
  const pack = c.req.query('pack');

  if (category && !(VALID_CATEGORIES as readonly string[]).includes(category)) {
    return c.json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` }, 400);
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const isPremiumActive = user?.isPremium && (!user.premiumUntil || new Date(user.premiumUntil) > new Date());
  if (!isPremiumActive) {
    return c.json({ error: 'Premium subscription required' }, 403);
  }

  const today = todayDate();
  const offset = (page - 1) * limit;
  const locale = c.req.query('locale') || user?.locale || 'en';

  const conditions = [
    eq(scenarios.status, 'published'),
    lte(scenarios.publishDate, today),
    eq(scenarios.locale, locale),
  ];
  if (category) {
    conditions.push(eq(scenarios.category, category));
  }
  if (pack) {
    conditions.push(sql`${scenarios.pack} = ${pack}`);
  }

  let archived = await db.query.scenarios.findMany({
    where: and(...conditions),
    orderBy: [desc(scenarios.publishDate)],
    limit,
    offset,
  });

  // Fallback to English if no results for user's locale
  if (archived.length === 0 && locale !== 'en' && offset === 0) {
    const enConditions = [
      eq(scenarios.status, 'published'),
      lte(scenarios.publishDate, today),
      eq(scenarios.locale, 'en'),
    ];
    if (category) {
      enConditions.push(eq(scenarios.category, category));
    }
    if (pack) {
      enConditions.push(sql`${scenarios.pack} = ${pack}`);
    }
    archived = await db.query.scenarios.findMany({
      where: and(...enConditions),
      orderBy: [desc(scenarios.publishDate)],
      limit,
      offset,
    });
  }

  return c.json({
    scenarios: archived.map((s) => ({
      id: s.id,
      title: s.title,
      category: s.category,
      publishDate: s.publishDate,
      totalVotes: s.totalVotes,
      pack: s.pack,
    })),
    page,
    limit,
  });
});

// GET /api/scenarios/:id
scenarioRoutes.get('/:id', authMiddleware, async (c) => {
  const scenarioId = c.req.param('id')!;
  const userId = c.get('userId');
  if (!uuidSchema.safeParse(scenarioId).success) {
    return c.json({ error: 'Invalid scenario ID format' }, 400);
  }

  const scenario = await db.query.scenarios.findFirst({
    where: eq(scenarios.id, scenarioId),
  });

  if (!scenario) {
    return c.json({ error: 'Scenario not found' }, 404);
  }

  const existingVote = await db.query.votes.findFirst({
    where: and(
      eq(votes.userId, userId),
      eq(votes.scenarioId, scenarioId),
    ),
  });

  return c.json({
    scenario: {
      id: scenario.id,
      title: scenario.title,
      body: scenario.body,
      category: scenario.category,
      expertAnalysis: existingVote ? scenario.expertAnalysis : null,
      outcome: existingVote ? scenario.outcome : null,
      publishDate: scenario.publishDate,
      locale: scenario.locale,
      pack: scenario.pack,
    },
    voted: !!existingVote,
    userVerdict: existingVote?.verdict || null,
    communityStats: existingVote
      ? {
          total: scenario.totalVotes,
          guilty: scenario.votesGuilty,
          notGuilty: scenario.votesNotGuilty,
          complicated: scenario.votesComplicated,
          bothWrong: scenario.votesBothWrong,
        }
      : null,
  });
});

// POST /api/scenarios/:id/predict
scenarioRoutes.post('/:id/predict', authMiddleware, async (c) => {
  const scenarioId = c.req.param('id')!;
  const userId = c.get('userId');
  if (!uuidSchema.safeParse(scenarioId).success) {
    return c.json({ error: 'Invalid scenario ID format' }, 400);
  }
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const parsed = verdictSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid verdict. Must be: guilty, not_guilty, complicated, both_wrong' }, 400);
  }

  const { verdict: predictedVerdict } = parsed.data;

  // Check scenario exists and is published
  const scenario = await db.query.scenarios.findFirst({
    where: eq(scenarios.id, scenarioId),
  });
  if (!scenario || scenario.status !== 'published') {
    return c.json({ error: 'Scenario not found or not published' }, 404);
  }

  // Check if user already has a prediction for this scenario
  const existingPrediction = await db.query.predictions.findFirst({
    where: and(
      eq(predictions.userId, userId),
      eq(predictions.scenarioId, scenarioId),
    ),
  });
  if (existingPrediction) {
    return c.json({ error: 'Already predicted on this scenario' }, 409);
  }

  // Check if user already voted (can't predict after voting)
  const existingVote = await db.query.votes.findFirst({
    where: and(
      eq(votes.userId, userId),
      eq(votes.scenarioId, scenarioId),
    ),
  });
  if (existingVote) {
    return c.json({ error: 'Cannot predict after voting' }, 409);
  }

  try {
    const [prediction] = await db.insert(predictions).values({
      userId,
      scenarioId,
      predictedVerdict,
    }).returning({ id: predictions.id });

    analytics.track('prediction_submitted', userId, {
      scenarioId,
      predictedVerdict,
    });

    return c.json({
      predictionId: prediction.id,
      predictedVerdict,
    });
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as { code: string }).code === '23505') {
      return c.json({ error: 'Already predicted on this scenario' }, 409);
    }
    throw err;
  }
});

// POST /api/scenarios/:id/vote
scenarioRoutes.post('/:id/vote', authMiddleware, async (c) => {
  const scenarioId = c.req.param('id')!;
  const userId = c.get('userId');
  if (!uuidSchema.safeParse(scenarioId).success) {
    return c.json({ error: 'Invalid scenario ID format' }, 400);
  }
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const parsed = verdictSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid verdict. Must be: guilty, not_guilty, complicated, both_wrong' }, 400);
  }

  const { verdict } = parsed.data;

  // Check scenario exists and is published
  const scenario = await db.query.scenarios.findFirst({
    where: eq(scenarios.id, scenarioId),
  });
  if (!scenario || scenario.status !== 'published') {
    return c.json({ error: 'Scenario not found or not published' }, 404);
  }

  // Check if already voted
  const existingVote = await db.query.votes.findFirst({
    where: and(
      eq(votes.userId, userId),
      eq(votes.scenarioId, scenarioId),
    ),
  });
  if (existingVote) {
    return c.json({ error: 'Already voted on this scenario' }, 409);
  }

  // Get user for streak calculation
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return c.json({ error: 'User not found' }, 404);

  // Calculate streak (use user timezone)
  const today = todayDate(user?.timezone ?? undefined);
  // Compute "yesterday" from today string to avoid UTC/timezone mismatch
  const todayParts = today.split('-').map(Number);
  const todayDateObj = new Date(Date.UTC(todayParts[0], todayParts[1] - 1, todayParts[2]));
  todayDateObj.setUTCDate(todayDateObj.getUTCDate() - 1);
  const yesterdayStr = todayDateObj.toISOString().split('T')[0];

  let newStreak = user.currentStreak;
  if (user.lastPlayedAt === today) {
    // Already played today — no streak change
  } else if (user.lastPlayedAt === yesterdayStr) {
    newStreak = user.currentStreak + 1;
  } else if (!user.lastPlayedAt) {
    newStreak = 1;
  } else {
    // Streak broken
    newStreak = 1;
  }

  // Verdict column mapping
  const verdictColumn = {
    guilty: scenarios.votesGuilty,
    not_guilty: scenarios.votesNotGuilty,
    complicated: scenarios.votesComplicated,
    both_wrong: scenarios.votesBothWrong,
  }[verdict];

  // Insert vote FIRST, then update counts — prevents drift on unique constraint violation
  const xpEarned = calculateVoteXp(newStreak, false); // majorityMatch calculated after insert
  try {
    await db.insert(votes).values({
      userId,
      scenarioId,
      verdict,
      xpEarned,
    });
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as { code: string }).code === '23505') {
      return c.json({ error: 'Already voted on this scenario' }, 409);
    }
    throw err;
  }

  // Update scenario vote counts AFTER successful insert (no drift on race condition)
  await db.update(scenarios).set({
    totalVotes: sql`${scenarios.totalVotes} + 1`,
    [verdictColumn.name]: sql`${verdictColumn} + 1`,
  }).where(eq(scenarios.id, scenarioId));

  // Get updated scenario for majority check
  const updatedScenario = await db.query.scenarios.findFirst({
    where: eq(scenarios.id, scenarioId),
  });

  if (!updatedScenario) return c.json({ error: 'Scenario not found' }, 404);

  // Check if user voted with majority
  const verdictCounts: Record<string, number> = {
    guilty: updatedScenario.votesGuilty,
    not_guilty: updatedScenario.votesNotGuilty,
    complicated: updatedScenario.votesComplicated,
    both_wrong: updatedScenario.votesBothWrong,
  };
  const maxVotes = Math.max(...Object.values(verdictCounts));
  const majorityMatch = verdictCounts[verdict] === maxVotes;

  // Recalculate XP with actual majorityMatch
  const finalXpEarned = calculateVoteXp(newStreak, majorityMatch);

  // Update vote XP if majority bonus changed it
  if (finalXpEarned !== xpEarned) {
    await db.update(votes).set({ xpEarned: finalXpEarned }).where(
      and(eq(votes.userId, userId), eq(votes.scenarioId, scenarioId))
    );
  }

  // Atomic updates to prevent race condition with concurrent votes
  const [updatedUser] = await db.update(users).set({
    xp: sql`${users.xp} + ${finalXpEarned}`,
    currentStreak: sql`${newStreak}`,
    longestStreak: sql`GREATEST(${newStreak}, ${users.longestStreak})`,
    lastPlayedAt: today,
    updatedAt: new Date(),
  }).where(eq(users.id, userId)).returning({ xp: users.xp });

  const newTotalXp = updatedUser.xp;
  const newLevel = calculateLevel(newTotalXp);

  // Update level based on actual XP value
  if (newLevel !== user.level) {
    await db.update(users).set({ level: newLevel }).where(eq(users.id, userId));
  }

  // Evaluate prediction if exists (BEFORE checkAchievements so prediction achievements are up-to-date)
  const PREDICTION_XP_REWARD = 15;
  let predictionResult: { predictedVerdict: string; isCorrect: boolean; xpEarned: number } | null = null;

  const existingPrediction = await db.query.predictions.findFirst({
    where: and(
      eq(predictions.userId, userId),
      eq(predictions.scenarioId, scenarioId),
    ),
  });

  if (existingPrediction) {
    // Majority verdict = the verdict with most votes (deterministic tie-break: alphabetical order)
    const verdictPriority = ['both_wrong', 'complicated', 'guilty', 'not_guilty'] as const;
    let majorityVerdict = verdictPriority[0];
    let majorityCount = verdictCounts[majorityVerdict] || 0;
    for (const v of verdictPriority) {
      const c = verdictCounts[v] || 0;
      if (c > majorityCount) {
        majorityVerdict = v;
        majorityCount = c;
      }
    }

    const isCorrect = existingPrediction.predictedVerdict === majorityVerdict;
    const predictionXp = isCorrect ? PREDICTION_XP_REWARD : 0;

    await db.update(predictions).set({
      isCorrect,
      xpEarned: predictionXp,
    }).where(eq(predictions.id, existingPrediction.id));

    if (isCorrect) {
      await db.update(users).set({
        xp: sql`${users.xp} + ${predictionXp}`,
      }).where(eq(users.id, userId));

      // Recalculate level after prediction XP
      const [refreshedUser] = await db.select({ xp: users.xp, level: users.level }).from(users).where(eq(users.id, userId));
      const levelAfterPrediction = calculateLevel(refreshedUser.xp);
      if (levelAfterPrediction !== refreshedUser.level) {
        await db.update(users).set({ level: levelAfterPrediction }).where(eq(users.id, userId));
      }
    }

    predictionResult = {
      predictedVerdict: existingPrediction.predictedVerdict,
      isCorrect,
      xpEarned: predictionXp,
    };

    analytics.track('prediction_evaluated', userId, {
      scenarioId,
      predictedVerdict: existingPrediction.predictedVerdict,
      majorityVerdict,
      isCorrect,
      xpEarned: predictionXp,
    });
  }

  // Check achievements (after prediction evaluation so oracle_10 / mind_reader_50 are current)
  const newAchievements = await checkAchievements(userId);

  // Send push notification for new achievements (fire and forget)
  if (newAchievements.length > 0 && user.pushToken) {
    sendPushNotification(user.pushToken, {
      title: '🏆 Achievement Unlocked!',
      body: newAchievements.length === 1
        ? `You unlocked: ${newAchievements[0]}`
        : `You unlocked ${newAchievements.length} achievements!`,
      data: { type: 'achievement' },
    }).catch(() => {});
  }

  // Server-side analytics
  analytics.track('vote', userId, {
    scenarioId,
    verdict: parsed.data.verdict,
    xpEarned: finalXpEarned,
    streak: newStreak,
    majorityMatch,
    level: newLevel,
  });

  if (newAchievements.length > 0) {
    for (const achievement of newAchievements) {
      analytics.track('achievement_unlock', userId, {
        achievementId: achievement,
        scenarioId,
      });
    }
  }

  return c.json({
    xpEarned: finalXpEarned,
    totalXp: newTotalXp,
    level: newLevel,
    streak: newStreak,
    majorityMatch,
    newAchievements,
    communityStats: {
      total: updatedScenario.totalVotes,
      guilty: updatedScenario.votesGuilty,
      notGuilty: updatedScenario.votesNotGuilty,
      complicated: updatedScenario.votesComplicated,
      bothWrong: updatedScenario.votesBothWrong,
    },
    expertAnalysis: updatedScenario.expertAnalysis,
    prediction: predictionResult,
  });
});

export default scenarioRoutes;
