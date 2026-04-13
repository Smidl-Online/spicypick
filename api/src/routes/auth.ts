import { Hono } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { users, refreshTokens, votes, userAchievements, leagueMembers, scenarioSubmissions, challenges, guildMembers, guilds, reports, passwordResetTokens } from '../db/schema.js';
import { eq, or, and, ne, sql, lt } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { AppEnv } from '../types.js';
import { sendPasswordResetEmail } from '../services/email.js';
import { analytics } from '../services/analytics.js';

const auth = new Hono<AppEnv>();

// Shared rate limit store for /register and /login — single IP budget so attackers can't bypass by switching endpoints
const authRateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Single cleanup timer for the shared store (unref to allow clean Docker shutdown)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of authRateLimitStore) {
    if (now > entry.resetAt) {
      authRateLimitStore.delete(key);
    }
  }
}, 300_000).unref();

function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

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
auth.post('/register', rateLimit(10, 60_000, authRateLimitStore), async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
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

  // Store hashed refresh token
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashRefreshToken(tokens.refreshToken),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  const emailHash = crypto.createHash('sha256').update(user.email.toLowerCase()).digest('hex');
  analytics.identify(user.id, { email_hash: emailHash, username: user.username });
  analytics.track('user_registered', user.id, { method: 'email' });

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
auth.post('/login', rateLimit(10, 60_000, authRateLimitStore), async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
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
    tokenHash: hashRefreshToken(tokens.refreshToken),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  analytics.track('session_start', user.id, { method: 'email' });

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
    },
    ...tokens,
  });
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// POST /api/auth/refresh
auth.post('/refresh', async (c) => {
  let reqBody: unknown;
  try { reqBody = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  const parsed = refreshSchema.safeParse(reqBody);
  if (!parsed.success) return c.json({ error: 'Refresh token required' }, 400);
  const { refreshToken } = parsed.data;

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { userId: string; email: string };
    const tokenHash = hashRefreshToken(refreshToken);

    // Verify token exists in DB
    const stored = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.tokenHash, tokenHash),
    });
    if (!stored) return c.json({ error: 'Invalid refresh token' }, 401);

    // Delete old token
    await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));

    // Generate new tokens
    const tokens = generateTokens(payload.userId, payload.email);

    await db.insert(refreshTokens).values({
      userId: payload.userId,
      tokenHash: hashRefreshToken(tokens.refreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    return c.json(tokens);
  } catch {
    return c.json({ error: 'Invalid refresh token' }, 401);
  }
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

// POST /api/auth/logout
auth.post('/logout', authMiddleware, async (c) => {
  const userId = c.get('userId');
  let reqBody: unknown;
  try { reqBody = await c.req.json(); } catch { reqBody = {}; }
  const parsed = logoutSchema.safeParse(reqBody);
  const refreshToken = parsed.success ? parsed.data.refreshToken : undefined;

  if (refreshToken) {
    // Delete specific refresh token by hash
    const tokenHash = hashRefreshToken(refreshToken);
    await db.delete(refreshTokens).where(
      and(eq(refreshTokens.userId, userId), eq(refreshTokens.tokenHash, tokenHash)),
    );
  } else {
    // Delete all refresh tokens for this user
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  }

  return c.json({ message: 'Logged out' });
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

// POST /api/auth/forgot-password
auth.post('/forgot-password', rateLimit(5, 60_000), async (c) => {
  let reqBody: unknown;
  try { reqBody = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  const parsed = forgotPasswordSchema.safeParse(reqBody);
  if (!parsed.success) return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  const { email } = parsed.data;

  // Always return success to not reveal if email exists
  const successResponse = { message: 'If account exists, password reset email sent' };

  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — password reset emails disabled');
    return c.json(successResponse);
  }

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) return c.json(successResponse);

  // Generate secure token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  // Invalidate previous tokens and store new one in a transaction
  // Then send email outside the transaction to avoid holding DB connection during external call
  try {
    await db.transaction(async (tx) => {
      await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
      await tx.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
    });
    await sendPasswordResetEmail(email, rawToken, user.locale);
  } catch (err) {
    console.error('Password reset failed:', err);
  }

  return c.json(successResponse);
});

// POST /api/auth/reset-password
auth.post('/reset-password', async (c) => {
  let reqBody: unknown;
  try { reqBody = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const schema = z.object({
    token: z.string().min(1),
    password: z.string().min(8).max(100),
  });
  const parsed = schema.safeParse(reqBody);
  if (!parsed.success) return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);

  const { token, password } = parsed.data;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // Find valid, unused token
  const resetToken = await db.query.passwordResetTokens.findFirst({
    where: and(
      eq(passwordResetTokens.tokenHash, tokenHash),
      sql`${passwordResetTokens.expiresAt} > NOW()`,
      sql`${passwordResetTokens.usedAt} IS NULL`,
    ),
  });

  if (!resetToken) return c.json({ error: 'Invalid or expired reset token' }, 400);

  const passwordHash = await bcrypt.hash(password, 12);

  await db.transaction(async (tx) => {
    // Update password
    await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, resetToken.userId));
    // Mark token as used
    await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, resetToken.id));
    // Revoke all refresh tokens for security
    await tx.delete(refreshTokens).where(eq(refreshTokens.userId, resetToken.userId));
  });

  return c.json({ message: 'Password reset successful. Please login with your new password.' });
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
    where: or(eq(challenges.challengerId, userId), eq(challenges.challengedId, userId)),
    columns: { id: true, scenarioId: true, challengerVerdict: true, challengedVerdict: true, status: true, createdAt: true },
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

  // Delete all user data in a transaction to prevent partial deletion
  await db.transaction(async (tx) => {
    await tx.delete(votes).where(eq(votes.userId, userId));
    await tx.delete(userAchievements).where(eq(userAchievements.userId, userId));
    await tx.delete(leagueMembers).where(eq(leagueMembers.userId, userId));
    await tx.delete(scenarioSubmissions).where(eq(scenarioSubmissions.userId, userId));
    await tx.delete(challenges).where(eq(challenges.challengerId, userId));
    await tx.delete(challenges).where(eq(challenges.challengedId, userId));
    await tx.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
    await tx.delete(reports).where(eq(reports.userId, userId));
    // Guild cleanup: decrement memberCount for guilds where user is regular member
    const memberships = await tx.query.guildMembers.findMany({
      where: and(eq(guildMembers.userId, userId), ne(guildMembers.role, 'leader')),
      columns: { guildId: true },
    });
    for (const m of memberships) {
      await tx.update(guilds).set({
        memberCount: sql`GREATEST(${guilds.memberCount} - 1, 0)`,
      }).where(eq(guilds.id, m.guildId));
    }
    await tx.delete(guildMembers).where(eq(guildMembers.userId, userId));
    // Delete guilds where user is leader (cascade deletes guild members)
    await tx.delete(guilds).where(eq(guilds.leaderId, userId));
    await tx.delete(users).where(eq(users.id, userId));
  });

  return c.json({ message: 'Account deleted' });
});

export default auth;
