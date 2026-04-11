import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/index.js';
import { guilds, guildMembers, users } from '../db/schema.js';
import { eq, desc, sql, and } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { AppEnv } from '../types.js';

const guildRoutes = new Hono<AppEnv>();

const createGuildSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(500).optional(),
});

// POST /api/guilds — create a guild
guildRoutes.post('/', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const parsed = createGuildSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input. Name must be 2-50 characters.' }, 400);
  }

  // Check if user is already in a guild
  const existingMembership = await db.query.guildMembers.findFirst({
    where: eq(guildMembers.userId, userId),
  });
  if (existingMembership) {
    return c.json({ error: 'You are already in a guild. Leave first.' }, 409);
  }

  // Check if guild name is taken
  const existingGuild = await db.query.guilds.findFirst({
    where: eq(guilds.name, parsed.data.name),
  });
  if (existingGuild) {
    return c.json({ error: 'Guild name already taken' }, 409);
  }

  const [guild] = await db.insert(guilds).values({
    name: parsed.data.name,
    description: parsed.data.description || null,
    leaderId: userId,
  }).returning();

  await db.insert(guildMembers).values({
    guildId: guild.id,
    userId,
    role: 'leader',
  });

  return c.json({ guild }, 201);
});

// GET /api/guilds — top guilds leaderboard
guildRoutes.get('/', authMiddleware, async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = (page - 1) * limit;

  const topGuilds = await db.query.guilds.findMany({
    orderBy: [desc(guilds.weeklyXp)],
    limit,
    offset,
  });

  return c.json({
    guilds: topGuilds.map((g, idx) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      avatarUrl: g.avatarUrl,
      weeklyXp: g.weeklyXp,
      totalXp: g.totalXp,
      memberCount: g.memberCount,
      maxMembers: g.maxMembers,
      rank: offset + idx + 1,
    })),
    page,
    limit,
  });
});

// GET /api/guilds/mine — current user's guild
guildRoutes.get('/mine', authMiddleware, async (c) => {
  const userId = c.get('userId');

  const membership = await db.query.guildMembers.findFirst({
    where: eq(guildMembers.userId, userId),
    with: {
      guild: true,
    },
  });

  if (!membership) {
    return c.json({ guild: null, message: 'You are not in a guild' });
  }

  const members = await db.query.guildMembers.findMany({
    where: eq(guildMembers.guildId, membership.guildId),
    orderBy: [desc(guildMembers.weeklyXp)],
    with: {
      user: true,
    },
  });

  return c.json({
    guild: {
      id: membership.guild.id,
      name: membership.guild.name,
      description: membership.guild.description,
      avatarUrl: membership.guild.avatarUrl,
      weeklyXp: membership.guild.weeklyXp,
      totalXp: membership.guild.totalXp,
      memberCount: membership.guild.memberCount,
      maxMembers: membership.guild.maxMembers,
    },
    userRole: membership.role,
    members: members.map((m, idx) => ({
      rank: idx + 1,
      userId: m.userId,
      username: m.user.username,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      weeklyXp: m.weeklyXp,
      isCurrentUser: m.userId === userId,
    })),
  });
});

// POST /api/guilds/:id/join
guildRoutes.post('/:id/join', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const guildId = c.req.param('id')!;

  // Check if user is already in a guild
  const existingMembership = await db.query.guildMembers.findFirst({
    where: eq(guildMembers.userId, userId),
  });
  if (existingMembership) {
    return c.json({ error: 'You are already in a guild. Leave first.' }, 409);
  }

  const guild = await db.query.guilds.findFirst({
    where: eq(guilds.id, guildId),
  });
  if (!guild) {
    return c.json({ error: 'Guild not found' }, 404);
  }
  if (guild.memberCount >= guild.maxMembers) {
    return c.json({ error: 'Guild is full' }, 409);
  }

  await db.insert(guildMembers).values({
    guildId,
    userId,
    role: 'member',
  });

  await db.update(guilds).set({
    memberCount: sql`${guilds.memberCount} + 1`,
  }).where(eq(guilds.id, guildId));

  return c.json({ message: 'Joined guild successfully' });
});

// POST /api/guilds/:id/leave
guildRoutes.post('/:id/leave', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const guildId = c.req.param('id')!;

  const membership = await db.query.guildMembers.findFirst({
    where: and(
      eq(guildMembers.guildId, guildId),
      eq(guildMembers.userId, userId),
    ),
  });
  if (!membership) {
    return c.json({ error: 'You are not a member of this guild' }, 404);
  }

  // Leaders cannot leave — they must transfer leadership or disband
  if (membership.role === 'leader') {
    return c.json({ error: 'Leaders cannot leave. Transfer leadership first.' }, 400);
  }

  await db.delete(guildMembers).where(
    and(
      eq(guildMembers.guildId, guildId),
      eq(guildMembers.userId, userId),
    ),
  );

  await db.update(guilds).set({
    memberCount: sql`${guilds.memberCount} - 1`,
  }).where(eq(guilds.id, guildId));

  return c.json({ message: 'Left guild successfully' });
});

// GET /api/guilds/:id — guild detail
guildRoutes.get('/:id', authMiddleware, async (c) => {
  const guildId = c.req.param('id')!;
  const userId = c.get('userId');

  const guild = await db.query.guilds.findFirst({
    where: eq(guilds.id, guildId),
  });
  if (!guild) {
    return c.json({ error: 'Guild not found' }, 404);
  }

  const members = await db.query.guildMembers.findMany({
    where: eq(guildMembers.guildId, guildId),
    orderBy: [desc(guildMembers.weeklyXp)],
    with: {
      user: true,
    },
  });

  return c.json({
    guild: {
      id: guild.id,
      name: guild.name,
      description: guild.description,
      avatarUrl: guild.avatarUrl,
      weeklyXp: guild.weeklyXp,
      totalXp: guild.totalXp,
      memberCount: guild.memberCount,
      maxMembers: guild.maxMembers,
      createdAt: guild.createdAt,
    },
    members: members.map((m, idx) => ({
      rank: idx + 1,
      userId: m.userId,
      username: m.user.username,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      weeklyXp: m.weeklyXp,
      isCurrentUser: m.userId === userId,
    })),
  });
});

export default guildRoutes;
