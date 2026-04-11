import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/index.js';
import { scenarioSubmissions } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { AppEnv } from '../types.js';

const submissionRoutes = new Hono<AppEnv>();

const submitSchema = z.object({
  body: z.string().min(50).max(2000),
});

// POST /api/submissions
submissionRoutes.post('/', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input. Body must be 50-2000 characters.', details: parsed.error.flatten() }, 400);
  }

  const [submission] = await db.insert(scenarioSubmissions).values({
    userId,
    body: parsed.data.body,
    status: 'pending',
  }).returning();

  return c.json({ submission }, 201);
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
