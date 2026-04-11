import { Hono } from 'hono';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { AppEnv } from '../types.js';

const premiumRoutes = new Hono<AppEnv>();

// POST /api/premium/subscribe
premiumRoutes.post('/subscribe', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  // In production, validate receipt from App Store / Google Play via RevenueCat
  // For now, accept a receipt and activate premium
  const { receipt, platform } = body;

  if (!receipt || !platform) {
    return c.json({ error: 'Receipt and platform required' }, 400);
  }

  // TODO: Validate receipt with RevenueCat API
  // For development, auto-activate premium for 30 days
  const premiumUntil = new Date();
  premiumUntil.setDate(premiumUntil.getDate() + 30);

  await db.update(users).set({
    isPremium: true,
    premiumUntil,
    streakFreezes: 3, // Premium gets 3 streak freezes
    updatedAt: new Date(),
  }).where(eq(users.id, userId));

  return c.json({
    message: 'Premium activated',
    premiumUntil: premiumUntil.toISOString(),
  });
});

// GET /api/premium/status
premiumRoutes.get('/status', authMiddleware, async (c) => {
  const userId = c.get('userId');

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return c.json({ error: 'User not found' }, 404);

  const isActive = user.isPremium && user.premiumUntil && new Date(user.premiumUntil) > new Date();

  return c.json({
    isPremium: isActive,
    premiumUntil: user.premiumUntil,
    features: isActive
      ? ['archive_access', 'extended_analysis', 'extra_scenarios', 'ad_free', 'streak_freezes_3']
      : [],
  });
});

export default premiumRoutes;
