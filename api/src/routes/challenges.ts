import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/index.js';
import { challenges, users, scenarios, votes } from '../db/schema.js';
import { eq, or, and, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { sendPushNotification } from '../services/pushNotifications.js';
import { AppEnv } from '../types.js';

const challengeRoutes = new Hono<AppEnv>();

const createChallengeSchema = z.object({
  challengedUsername: z.string(),
  scenarioId: z.string().uuid(),
});

const respondSchema = z.object({
  verdict: z.enum(['guilty', 'not_guilty', 'complicated', 'both_wrong']),
});

// POST /api/challenges
challengeRoutes.post('/', authMiddleware, async (c) => {
  const userId = c.get('userId');
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const parsed = createChallengeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const { challengedUsername, scenarioId } = parsed.data;

  // Find challenged user
  const challengedUser = await db.query.users.findFirst({
    where: eq(users.username, challengedUsername),
  });
  if (!challengedUser) {
    return c.json({ error: 'User not found' }, 404);
  }
  if (challengedUser.id === userId) {
    return c.json({ error: 'Cannot challenge yourself' }, 400);
  }

  // Verify scenario exists
  const scenario = await db.query.scenarios.findFirst({
    where: eq(scenarios.id, scenarioId),
  });
  if (!scenario) {
    return c.json({ error: 'Scenario not found' }, 404);
  }

  // Get challenger's vote on this scenario
  const challengerVote = await db.query.votes.findFirst({
    where: and(
      eq(votes.userId, userId),
      eq(votes.scenarioId, scenarioId),
    ),
  });

  const challenger = await db.query.users.findFirst({ where: eq(users.id, userId) });

  const [challenge] = await db.insert(challenges).values({
    challengerId: userId,
    challengedId: challengedUser.id,
    scenarioId,
    challengerVerdict: challengerVote?.verdict || null,
    status: 'pending',
  }).returning();

  // Send push notification to challenged user
  if (challengedUser.pushToken && challengedUser.notifChallenges) {
    sendPushNotification(challengedUser.pushToken, {
      title: '⚡ New Challenge!',
      body: `${challenger?.username || 'Someone'} challenged you!`,
      data: { type: 'challenge', scenarioId, challengeId: challenge.id },
    }).catch(() => {}); // Fire and forget
  }

  return c.json({ challenge }, 201);
});

// GET /api/challenges
challengeRoutes.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId');

  const userChallenges = await db.query.challenges.findMany({
    where: or(
      eq(challenges.challengerId, userId),
      eq(challenges.challengedId, userId),
    ),
    orderBy: [desc(challenges.createdAt)],
    with: {
      challenger: true,
      challenged: true,
      scenario: true,
    },
  });

  return c.json({
    challenges: userChallenges.map((ch) => ({
      id: ch.id,
      challenger: {
        id: ch.challenger?.id,
        username: ch.challenger?.username,
        avatarUrl: ch.challenger?.avatarUrl,
      },
      challenged: {
        id: ch.challenged?.id,
        username: ch.challenged?.username,
        avatarUrl: ch.challenged?.avatarUrl,
      },
      scenario: {
        id: ch.scenario?.id,
        title: ch.scenario?.title,
        category: ch.scenario?.category,
      },
      challengerVerdict: ch.challengerVerdict,
      challengedVerdict: ch.challengedVerdict,
      status: ch.status,
      createdAt: ch.createdAt,
      isChallenger: ch.challengerId === userId,
    })),
  });
});

const uuidSchema = z.string().uuid();

// POST /api/challenges/:id/respond
challengeRoutes.post('/:id/respond', authMiddleware, async (c) => {
  const challengeId = c.req.param('id')!;
  if (!uuidSchema.safeParse(challengeId).success) {
    return c.json({ error: 'Invalid challenge ID format' }, 400);
  }
  const userId = c.get('userId');
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const parsed = respondSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid verdict' }, 400);
  }

  const challenge = await db.query.challenges.findFirst({
    where: eq(challenges.id, challengeId),
  });

  if (!challenge || challenge.challengedId !== userId) return c.json({ error: 'Challenge not found' }, 404);
  if (challenge.status !== 'pending') return c.json({ error: 'Challenge already completed' }, 400);

  // Atomic update with status check to prevent TOCTOU race condition
  const [updated] = await db.update(challenges).set({
    challengedVerdict: parsed.data.verdict,
    status: 'completed',
  }).where(and(eq(challenges.id, challengeId), eq(challenges.status, 'pending'))).returning();

  if (!updated) return c.json({ error: 'Challenge already completed' }, 400);

  return c.json({
    message: 'Challenge completed',
    challengerVerdict: challenge.challengerVerdict,
    challengedVerdict: parsed.data.verdict,
    match: challenge.challengerVerdict === parsed.data.verdict,
  });
});

export default challengeRoutes;
