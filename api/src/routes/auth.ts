import { Hono } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { users, refreshTokens, votes, userAchievements, leagueMembers, scenarioSubmissions, challenges } from '../db/schema.js';
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
  await db.delete(users).where(eq(users.id, userId));

  return c.json({ message: 'Account deleted' });
});

export default auth;
