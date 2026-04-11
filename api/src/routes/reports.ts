import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/index.js';
import { reports, scenarios } from '../db/schema.js';
import { eq, and, count } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { AppEnv } from '../types.js';

const reportRoutes = new Hono<AppEnv>();

const reportSchema = z.object({
  scenarioId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

// POST /api/reports
reportRoutes.post('/', authMiddleware, async (c) => {
  const userId = c.get('userId');
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input' }, 400);
  }

  const { scenarioId, reason } = parsed.data;

  // Check scenario exists
  const scenario = await db.query.scenarios.findFirst({ where: eq(scenarios.id, scenarioId) });
  if (!scenario) return c.json({ error: 'Scenario not found' }, 404);

  // Insert report (unique per user+scenario)
  await db.insert(reports).values({
    userId,
    scenarioId,
    reason: reason || null,
  }).onConflictDoNothing();

  // Check if 3+ reports → auto-hide
  const [reportCount] = await db.select({ count: count() }).from(reports).where(eq(reports.scenarioId, scenarioId));
  if (reportCount.count >= 3) {
    await db.update(scenarios).set({ status: 'archived' }).where(eq(scenarios.id, scenarioId));
  }

  return c.json({ message: 'Report submitted' });
});

export default reportRoutes;
