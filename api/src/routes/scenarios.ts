import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/index.js';
import { scenarios, votes, users } from '../db/schema.js';
import { eq, sql, and, desc, lte } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { calculateVoteXp, calculateLevel, checkAchievements } from '../services/gamification.js';
import { AppEnv } from '../types.js';
import { VALID_CATEGORIES } from '../constants.js';

const scenarioRoutes = new Hono<AppEnv>();

const uuidSchema = z.string().uuid();
const VALID_VERDICTS = ['guilty', 'not_guilty', 'complicated', 'both_wrong'] as const;
const verdictSchema = z.object({
  verdict: z.enum(VALID_VERDICTS),
});

function todayDate(): string {
  return new Date().toISOString().split('T')[0];
}

// GET /api/scenarios/today
scenarioRoutes.get('/today', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const today = todayDate();

  const scenario = await db.query.scenarios.findFirst({
    where: and(
      eq(scenarios.publishDate, today),
      eq(scenarios.status, 'published'),
    ),
  });

  if (!scenario) {
    return c.json({ scenario: null, message: 'No scenario today yet' });
  }

  // Check if user already voted
  const existingVote = await db.query.votes.findFirst({
    where: and(
      eq(votes.userId, userId),
      eq(votes.scenarioId, scenario.id),
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
      },
      voted: true,
      userVerdict: existingVote.verdict,
      communityStats: {
        total: scenario.totalVotes,
        guilty: scenario.votesGuilty,
        notGuilty: scenario.votesNotGuilty,
        complicated: scenario.votesComplicated,
        bothWrong: scenario.votesBothWrong,
      },
    });
  }

  return c.json({
    scenario: {
      id: scenario.id,
      title: scenario.title,
      body: scenario.body,
      category: scenario.category,
      publishDate: scenario.publishDate,
    },
    voted: false,
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

// GET /api/scenarios/archive (premium only)
scenarioRoutes.get('/archive/list', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const parsedPage = parseInt(c.req.query('page') || '1');
  const page = Math.max(Number.isFinite(parsedPage) ? parsedPage : 1, 1);
  const rawLimit = parseInt(c.req.query('limit') || '20');
  const limit = Math.min(Math.max(rawLimit || 20, 1), 50);
  const category = c.req.query('category');

  if (category && !(VALID_CATEGORIES as readonly string[]).includes(category)) {
    return c.json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` }, 400);
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user?.isPremium) {
    return c.json({ error: 'Premium subscription required' }, 403);
  }

  const today = todayDate();
  const offset = (page - 1) * limit;

  const conditions = [
    eq(scenarios.status, 'published'),
    lte(scenarios.publishDate, today),
  ];
  if (category) {
    conditions.push(eq(scenarios.category, category));
  }

  const archived = await db.query.scenarios.findMany({
    where: and(...conditions),
    orderBy: [desc(scenarios.publishDate)],
    limit,
    offset,
  });

  return c.json({
    scenarios: archived.map((s) => ({
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

// POST /api/scenarios/:id/vote
scenarioRoutes.post('/:id/vote', authMiddleware, async (c) => {
  const scenarioId = c.req.param('id')!;
  const userId = c.get('userId');
  if (!uuidSchema.safeParse(scenarioId).success) {
    return c.json({ error: 'Invalid scenario ID format' }, 400);
  }
  const body = await c.req.json();

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

  // Update scenario vote counts
  const verdictColumn = {
    guilty: scenarios.votesGuilty,
    not_guilty: scenarios.votesNotGuilty,
    complicated: scenarios.votesComplicated,
    both_wrong: scenarios.votesBothWrong,
  }[verdict];

  await db.update(scenarios).set({
    totalVotes: sql`${scenarios.totalVotes} + 1`,
    [verdictColumn.name]: sql`${verdictColumn} + 1`,
  }).where(eq(scenarios.id, scenarioId));

  // Get updated scenario for majority check
  const updatedScenario = await db.query.scenarios.findFirst({
    where: eq(scenarios.id, scenarioId),
  });

  // Check if user voted with majority
  const verdictCounts: Record<string, number> = {
    guilty: updatedScenario!.votesGuilty,
    not_guilty: updatedScenario!.votesNotGuilty,
    complicated: updatedScenario!.votesComplicated,
    both_wrong: updatedScenario!.votesBothWrong,
  };
  const maxVotes = Math.max(...Object.values(verdictCounts));
  const majorityMatch = verdictCounts[verdict] === maxVotes;

  // Calculate streak
  const today = todayDate();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

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

  // Calculate XP
  const xpEarned = calculateVoteXp(newStreak, majorityMatch);

  // Insert vote
  await db.insert(votes).values({
    userId,
    scenarioId,
    verdict,
    xpEarned,
  });

  // Update user
  const newTotalXp = user.xp + xpEarned;
  const newLevel = calculateLevel(newTotalXp);

  await db.update(users).set({
    xp: newTotalXp,
    level: newLevel,
    currentStreak: newStreak,
    longestStreak: Math.max(newStreak, user.longestStreak),
    lastPlayedAt: today,
    updatedAt: new Date(),
  }).where(eq(users.id, userId));

  // Check achievements
  const newAchievements = await checkAchievements(userId);

  return c.json({
    xpEarned,
    totalXp: newTotalXp,
    level: newLevel,
    streak: newStreak,
    majorityMatch,
    newAchievements,
    communityStats: {
      total: updatedScenario!.totalVotes,
      guilty: updatedScenario!.votesGuilty,
      notGuilty: updatedScenario!.votesNotGuilty,
      complicated: updatedScenario!.votesComplicated,
      bothWrong: updatedScenario!.votesBothWrong,
    },
    expertAnalysis: updatedScenario!.expertAnalysis,
  });
});

export default scenarioRoutes;
