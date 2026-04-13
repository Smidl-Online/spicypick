import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import type { AppEnv } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { experiments, experimentAssignments } from '../db/schema.js';
import {
  getUserExperiments,
  getOrAssignVariant,
  trackExperimentEvent,
  getExperimentResults,
} from '../services/experiments.js';

const experimentRoutes = new Hono<AppEnv>();

// ============================================
// GET /me — get all active experiments for current user
// ============================================
experimentRoutes.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const assignments = await getUserExperiments(userId);
  return c.json({ experiments: assignments });
});

// ============================================
// GET /me/:key — get assignment for a specific experiment
// ============================================
experimentRoutes.get('/me/:key', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const key = c.req.param('key')!;

  const variant = await getOrAssignVariant(key, userId);
  if (variant === null) {
    return c.json({ experiment: key, variant: null, enrolled: false });
  }

  return c.json({ experiment: key, variant, enrolled: true });
});

// ============================================
// POST /track — track conversion event
// ============================================
const trackSchema = z.object({
  experimentKey: z.string().min(1),
  eventType: z.string().min(1),
  eventValue: z.number().int().positive().optional(),
  metadata: z.record(z.unknown()).optional(),
});

experimentRoutes.post('/track', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = trackSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const { experimentKey, eventType, eventValue, metadata } = parsed.data;
  const tracked = await trackExperimentEvent(
    experimentKey,
    userId,
    eventType,
    eventValue,
    metadata,
  );

  if (!tracked) {
    return c.json({ error: 'Not enrolled in experiment' }, 404);
  }

  return c.json({ success: true });
});

// ============================================
// GET /:key/results — get experiment results (admin-like, but auth-protected)
// ============================================
experimentRoutes.get('/:key/results', authMiddleware, async (c) => {
  const key = c.req.param('key')!;
  const results = await getExperimentResults(key);

  if (!results) {
    return c.json({ error: 'Experiment not found' }, 404);
  }

  return c.json(results);
});

export default experimentRoutes;
