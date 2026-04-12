import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/index.js';
import { scenarioSubmissions } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { AppEnv } from '../types.js';
import { moderateContent } from '../services/contentModeration.js';

const submissionRoutes = new Hono<AppEnv>();

const submitSchema = z.object({
  body: z.string().min(50).max(2000),
});

// POST /api/submissions
submissionRoutes.post('/', authMiddleware, async (c) => {
  const userId = c.get('userId');
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input. Body must be 50-2000 characters.', details: parsed.error.flatten() }, 400);
  }

  // AI pre-screening
  const moderation = await moderateContent(parsed.data.body);

  const status = moderation.approved ? 'approved' : 'pending';
  const moderatorNotes = moderation.approved
    ? `AI auto-approved: ${moderation.reason}`
    : moderation.flags.length > 0
      ? `AI flagged (${moderation.flags.join(', ')}): ${moderation.reason}`
      : `AI review: ${moderation.reason}`;

  const [submission] = await db.insert(scenarioSubmissions).values({
    userId,
    body: parsed.data.body,
    status,
    moderatorNotes,
  }).returning();

  return c.json({
    submission,
    moderation: {
      autoApproved: moderation.approved,
      suggestedCategory: moderation.category,
      flags: moderation.flags,
    },
  }, 201);
});

// GET /api/submissions/mine
submissionRoutes.get('/mine', authMiddleware, async (c) => {
  const userId = c.get('userId');

  const subs = await db.query.scenarioSubmissions.findMany({
    where: eq(scenarioSubmissions.userId, userId),
    orderBy: [desc(scenarioSubmissions.createdAt)],
  });

  return c.json({
    submissions: subs.map((s) => ({
      id: s.id,
      body: s.body,
      status: s.status,
      moderatorNotes: s.moderatorNotes,
      createdAt: s.createdAt,
    })),
  });
});

export default submissionRoutes;
