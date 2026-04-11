import { Hono } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { users, refreshTokens, votes, userAchievements, leagueMembers, scenarioSubmissions, challenges, guildMembers, guilds } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { AppEnv } from '../types.js';

const auth = new Hono<AppEnv>();

const registerSchema = z.object({
  email: z.string().email().max(255),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function generateTokens(userId: string, email: string) {
  const accessToken = jwt.sign(
    { userId, email },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' },
  );
  const refreshToken = jwt.sign(
    { userId, email },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '30d' },
  );
  return { accessToken, refreshToken };
}

// POST /api/auth/register
auth.post('/register', async (c) => {
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const { email, username, password } = parsed.data;

  // Check existing
  const existingEmail = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existingEmail) return c.json({ error: 'Email already registered' }, 409);

  const existingUsername = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (existingUsername) return c.json({ error: 'Username already taken' }, 409);

  const passwordHash = await bcrypt.hash(password, 12);

  const [user] = await db.insert(users).values({
    email,
    username,
    passwordHash,
  }).returning();

  const tokens = generateTokens(user.id, user.email);

  // Store refresh token
  await db.insert(refreshTokens).values({
    userId: user.id,
    token: tokens.refreshToken,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
    },
    ...tokens,
  }, 201);
});

// POST /api/auth/login
auth.post('/login', async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input' }, 400);
  }

  const { email, password } = parsed.data;

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) return c.json({ error: 'Invalid credentials' }, 401);

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401);

  const tokens = generateTokens(user.id, user.email);

  await db.insert(refreshTokens).values({
    userId: user.id,
    token: tokens.refreshToken,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
    },
    ...tokens,
  });
});

// POST /api/auth/refresh
auth.post('/refresh', async (c) => {
  const { refreshToken } = await c.req.json();
  if (!refreshToken) return c.json({ error: 'Refresh token required' }, 400);

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { userId: string; email: string };

    // Verify token exists in DB
    const stored = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.token, refreshToken),
    });
    if (!stored) return c.json({ error: 'Invalid refresh token' }, 401);

    // Delete old token
    await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));

    // Generate new tokens
    const tokens = generateTokens(payload.userId, payload.email);

    await db.insert(refreshTokens).values({
      userId: payload.userId,
      token: tokens.refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    return c.json(tokens);
  } catch {
    return c.json({ error: 'Invalid refresh token' }, 401);
  }
});

// POST /api/auth/forgot-password
auth.post('/forgot-password', async (c) => {
  const { email } = await c.req.json();
  if (!email) return c.json({ error: 'Email required' }, 400);

  // Always return success to prevent email enumeration
  // In production, send email via Resend
  return c.json({ message: 'If account exists, password reset email sent' });
});

// GET /api/auth/export (GDPR data export)
auth.get('/export', authMiddleware, async (c) => {
  const userId = c.get('userId');

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      email: true,
      username: true,
      avatarUrl: true,
      xp: true,
      level: true,
      currentStreak: true,
      longestStreak: true,
      streakFreezes: true,
      lastPlayedAt: true,
      isPremium: true,
      premiumUntil: true,
      locale: true,
      timezone: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user) return c.json({ error: 'User not found' }, 404);

  const userVotes = await db.query.votes.findMany({
    where: eq(votes.userId, userId),
    columns: { id: true, scenarioId: true, verdict: true, xpEarned: true, votedAt: true },
  });

  const userAchievementsList = await db.query.userAchievements.findMany({
    where: eq(userAchievements.userId, userId),
    columns: { achievementId: true, unlockedAt: true },
  });

  const userSubmissions = await db.query.scenarioSubmissions.findMany({
    where: eq(scenarioSubmissions.userId, userId),
    columns: { id: true, body: true, status: true, createdAt: true },
  });

  const userChallenges = await db.query.challenges.findMany({
    where: eq(challenges.challengerId, userId),
    columns: { id: true, scenarioId: true, challengerVerdict: true, status: true, createdAt: true },
  });

  const userGuildMemberships = await db.query.guildMembers.findMany({
    where: eq(guildMembers.userId, userId),
    columns: { guildId: true, role: true, weeklyXp: true, joinedAt: true },
  });

  const exportData = {
    exportedAt: new Date().toISOString(),
    user,
    votes: userVotes,
    achievements: userAchievementsList,
    submissions: userSubmissions,
    challenges: userChallenges,
    guildMemberships: userGuildMemberships,
  };

  c.header('Content-Disposition', `attachment; filename="spicypick-export-${userId}.json"`);
  c.header('Content-Type', 'application/json');
  return c.json(exportData);
});

// DELETE /api/auth/account (GDPR)
auth.delete('/account', authMiddleware, async (c) => {
  const userId = c.get('userId');

  // Delete all user data
  await db.delete(votes).where(eq(votes.userId, userId));
  await db.delete(userAchievements).where(eq(userAchievements.userId, userId));
  await db.delete(leagueMembers).where(eq(leagueMembers.userId, userId));
  await db.delete(scenarioSubmissions).where(eq(scenarioSubmissions.userId, userId));
  await db.delete(challenges).where(eq(challenges.challengerId, userId));
  await db.delete(challenges).where(eq(challenges.challengedId, userId));
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  // Guild cleanup: remove memberships, delete guilds where user is leader
  await db.delete(guildMembers).where(eq(guildMembers.userId, userId));
  await db.delete(guilds).where(eq(guilds.leaderId, userId));
  await db.delete(users).where(eq(users.id, userId));

  return c.json({ message: 'Account deleted' });
});

export default auth;
