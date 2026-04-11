import { Hono } from 'hono';
import { db } from '../db/index.js';
import { achievements, userAchievements } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { AppEnv } from '../types.js';

const achievementRoutes = new Hono<AppEnv>();

// GET /api/achievements
achievementRoutes.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId');

  const allAchievements = await db.query.achievements.findMany();
  const userUnlocked = await db.query.userAchievements.findMany({
    where: eq(userAchievements.userId, userId),
  });

  const unlockedMap = new Map(userUnlocked.map((ua) => [ua.achievementId, ua.unlockedAt]));

  return c.json({
    achievements: allAchievements.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      icon: a.icon,
      xpReward: a.xpReward,
      unlocked: unlockedMap.has(a.id),
      unlockedAt: unlockedMap.get(a.id) || null,
    })),
  });
});

export default achievementRoutes;
