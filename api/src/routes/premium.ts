import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { AppEnv } from '../types.js';
import { getSubscriptionStatus, validateReceipt } from '../services/revenueCat.js';
import { analytics } from '../services/analytics.js';

const premiumRoutes = new Hono<AppEnv>();

const subscribeSchema = z.object({
  platform: z.enum(['ios', 'android']),
  receipt: z.string().optional(),
});

// POST /api/premium/subscribe
premiumRoutes.post('/subscribe', authMiddleware, async (c) => {
  const userId = c.get('userId');
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Platform (ios/android) required' }, 400);
  }

  const { platform, receipt } = parsed.data;

  // If RevenueCat is configured, verify subscription status
  if (process.env.REVENUECAT_API_KEY) {
    try {
      let result = await getSubscriptionStatus(userId);

      // If status check failed but client provided a receipt, try receipt validation
      // This recovers purchases where RC identity wasn't linked before purchase
      if (!result.isActive && receipt) {
        result = await validateReceipt(userId, receipt, platform);
      }

      if (!result.isActive || !result.expiresAt) {
        return c.json({ error: 'Subscription is not active' }, 402);
      }

      await db.update(users).set({
        isPremium: true,
        premiumUntil: result.expiresAt,
        streakFreezes: 3,
        updatedAt: new Date(),
      }).where(eq(users.id, userId));

      analytics.track('premium_subscribe', userId, {
        platform,
        productId: result.productId,
        premiumUntil: result.expiresAt.toISOString(),
      });

      return c.json({
        message: 'Premium activated',
        premiumUntil: result.expiresAt.toISOString(),
        productId: result.productId,
      });
    } catch (err) {
      console.error('RevenueCat verification error:', err);
      return c.json({ error: 'Subscription verification failed' }, 400);
    }
  }

  // Development fallback: auto-activate premium for 30 days (blocked in production)
  if (process.env.NODE_ENV === 'production') {
    console.error('REVENUECAT_API_KEY is not set in production — rejecting subscribe request');
    return c.json({ error: 'Payment processing unavailable' }, 503);
  }

  console.warn('REVENUECAT_API_KEY not set — using development mode (auto-activate 30 days)');
  const premiumUntil = new Date();
  premiumUntil.setDate(premiumUntil.getDate() + 30);

  await db.update(users).set({
    isPremium: true,
    premiumUntil,
    streakFreezes: 3,
    updatedAt: new Date(),
  }).where(eq(users.id, userId));

  analytics.track('premium_subscribe', userId, {
    platform,
    devMode: true,
    premiumUntil: premiumUntil.toISOString(),
  });

  return c.json({
    message: 'Premium activated (dev mode)',
    premiumUntil: premiumUntil.toISOString(),
  });
});

// GET /api/premium/status
premiumRoutes.get('/status', authMiddleware, async (c) => {
  const userId = c.get('userId');

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return c.json({ error: 'User not found' }, 404);

  // If RevenueCat is configured, check live status
  if (process.env.REVENUECAT_API_KEY) {
    try {
      const result = await getSubscriptionStatus(userId);

      // Sync RevenueCat status to local DB
      if (result.isActive !== user.isPremium) {
        await db.update(users).set({
          isPremium: result.isActive,
          premiumUntil: result.expiresAt,
          updatedAt: new Date(),
        }).where(eq(users.id, userId));
      }

      return c.json({
        isPremium: result.isActive,
        premiumUntil: result.expiresAt,
        features: result.isActive
          ? ['archive_access', 'extended_analysis', 'extra_scenarios', 'ad_free', 'streak_freezes_3']
          : [],
      });
    } catch (err) {
      console.error('RevenueCat status check failed, using local DB:', err);
    }
  }

  // Fallback to local DB
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
