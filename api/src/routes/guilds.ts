import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/index.js';
import { guilds, guildMembers, users } from '../db/schema.js';
import { eq, desc, sql, and } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { AppEnv } from '../types.js';

const guildRoutes = new Hono<AppEnv>();

const uuidSchema = z.string().uuid();

const createGuildSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(500).optional(),
});

// POST /api/guilds — create a guild
guildRoutes.post('/', authMiddleware, async (c) => {
  const userId = c.get('userId');
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const parsed = createGuildSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input. Name must be 2-50 characters.' }, 400);
  }

  try {
    const result = await db.transaction(async (tx) => {
      const existingMembership = await tx.query.guildMembers.findFirst({
        where: eq(guildMembers.userId, userId),
      });
      if (existingMembership) {
        return { error: 'You are already in a guild. Leave first.', status: 409 as const };
      }

      const existingGuild = await tx.query.guilds.findFirst({
        where: eq(guilds.name, parsed.data.name),
      });
      if (existingGuild) {
        return { error: 'Guild name already taken', status: 409 as const };
      }

      const [newGuild] = await tx.insert(guilds).values({
        name: parsed.data.name,
        description: parsed.data.description || null,
        leaderId: userId,
      }).returning();

      await tx.insert(guildMembers).values({
        guildId: newGuild.id,
        userId,
        role: 'leader',
      });

      return { guild: newGuild };
    });

    if ('error' in result) {
      return c.json({ error: result.error }, result.status);
    }

    return c.json({ guild: result.guild }, 201);
  } catch (err: any) {
    // Catch unique constraint violation from concurrent create race
    if (err?.code === '23505') {
      return c.json({ error: 'Guild name already taken' }, 409);
    }
    throw err;
  }
});

// GET /api/guilds — top guilds leaderboard
guildRoutes.get('/', authMiddleware, async (c) => {
  const parsedPage = parseInt(c.req.query('page') || '1');
  const page = Math.max(Number.isFinite(parsedPage) ? parsedPage : 1, 1);
  const rawLimit = parseInt(c.req.query('limit') || '20');
  const limit = Math.min(Math.max(rawLimit || 20, 1), 50);
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

  // Select only needed user columns instead of full user object
  const members = await db.select({
    userId: guildMembers.userId,
    role: guildMembers.role,
    weeklyXp: guildMembers.weeklyXp,
    username: users.username,
    avatarUrl: users.avatarUrl,
  })
    .from(guildMembers)
    .innerJoin(users, eq(guildMembers.userId, users.id))
    .where(eq(guildMembers.guildId, membership.guildId))
    .orderBy(desc(guildMembers.weeklyXp));

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
      username: m.username,
      avatarUrl: m.avatarUrl,
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

  if (!uuidSchema.safeParse(guildId).success) {
    return c.json({ error: 'Invalid guild ID format' }, 400);
  }

  try {
    const result = await db.transaction(async (tx) => {
      const existingMembership = await tx.query.guildMembers.findFirst({
        where: eq(guildMembers.userId, userId),
      });
      if (existingMembership) {
        return { error: 'You are already in a guild. Leave first.', status: 409 as const };
      }

      // Atomically increment memberCount only if below maxMembers
      const [updated] = await tx.update(guilds).set({
        memberCount: sql`${guilds.memberCount} + 1`,
      }).where(
        and(
          eq(guilds.id, guildId),
          sql`${guilds.memberCount} < ${guilds.maxMembers}`,
        ),
      ).returning();

      if (!updated) {
        const guild = await tx.query.guilds.findFirst({ where: eq(guilds.id, guildId) });
        if (!guild) return { error: 'Guild not found', status: 404 as const };
        return { error: 'Guild is full', status: 409 as const };
      }

      await tx.insert(guildMembers).values({
        guildId,
        userId,
        role: 'member',
      });

      return { success: true };
    });

    if ('error' in result) {
      return c.json({ error: result.error }, result.status);
    }

    return c.json({ message: 'Joined guild successfully' });
  } catch (err: any) {
    // Catch unique constraint violation from concurrent join race
    if (err?.code === '23505') {
      return c.json({ error: 'You are already in a guild. Leave first.' }, 409);
    }
    throw err;
  }
});

// POST /api/guilds/:id/leave
guildRoutes.post('/:id/leave', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const guildId = c.req.param('id')!;

  if (!uuidSchema.safeParse(guildId).success) {
    return c.json({ error: 'Invalid guild ID format' }, 400);
  }

  const result = await db.transaction(async (tx) => {
    const membership = await tx.query.guildMembers.findFirst({
      where: and(
        eq(guildMembers.guildId, guildId),
        eq(guildMembers.userId, userId),
      ),
    });
    if (!membership) {
      return { error: 'You are not a member of this guild', status: 404 as const };
    }

    if (membership.role === 'leader') {
      return { error: 'Leaders cannot leave. Transfer leadership first.', status: 400 as const };
    }

    const deleted = await tx.delete(guildMembers).where(
      and(
        eq(guildMembers.guildId, guildId),
        eq(guildMembers.userId, userId),
      ),
    ).returning({ id: guildMembers.id });

    // Only decrement if a row was actually deleted
    if (deleted.length > 0) {
      await tx.update(guilds).set({
        memberCount: sql`GREATEST(${guilds.memberCount} - 1, 0)`,
      }).where(eq(guilds.id, guildId));
    }

    return { success: true };
  });

  if ('error' in result) {
    return c.json({ error: result.error }, result.status);
  }

  return c.json({ message: 'Left guild successfully' });
});

// GET /api/guilds/:id — guild detail
guildRoutes.get('/:id', authMiddleware, async (c) => {
  const guildId = c.req.param('id')!;
  const userId = c.get('userId');

  if (!uuidSchema.safeParse(guildId).success) {
    return c.json({ error: 'Invalid guild ID format' }, 400);
  }

  const guild = await db.query.guilds.findFirst({
    where: eq(guilds.id, guildId),
  });
  if (!guild) {
    return c.json({ error: 'Guild not found' }, 404);
  }

  // Select only needed user columns instead of full user object
  const members = await db.select({
    userId: guildMembers.userId,
    role: guildMembers.role,
    weeklyXp: guildMembers.weeklyXp,
    username: users.username,
    avatarUrl: users.avatarUrl,
  })
    .from(guildMembers)
    .innerJoin(users, eq(guildMembers.userId, users.id))
    .where(eq(guildMembers.guildId, guildId))
    .orderBy(desc(guildMembers.weeklyXp));

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
      username: m.username,
      avatarUrl: m.avatarUrl,
      role: m.role,
      weeklyXp: m.weeklyXp,
      isCurrentUser: m.userId === userId,
    })),
  });
});

export default guildRoutes;
