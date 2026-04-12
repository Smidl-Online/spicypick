import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../db/index.js', () => ({
  db: {
    query: {
      guilds: { findFirst: vi.fn(), findMany: vi.fn() },
      guildMembers: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => [{ id: 'guild-1', name: 'TestGuild', memberCount: 1 }]) })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => [{ id: 'guild-1' }]) })) })) })),
    delete: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => [{ id: 'member-1' }]) })) })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => []),
          })),
        })),
      })),
    })),
    transaction: vi.fn(async (fn: any) => fn({
      query: {
        guilds: { findFirst: vi.fn() },
        guildMembers: { findFirst: vi.fn() },
      },
      insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => [{ id: 'guild-1', name: 'TestGuild', memberCount: 1 }]) })) })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => [{ id: 'guild-1' }]) })) })) })),
      delete: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => [{ id: 'member-1' }]) })) })),
    })),
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(() => ({ userId: 'user-1', email: 'test@test.com' })),
  },
}));

process.env.JWT_SECRET = 'test-secret';

import { db } from '../db/index.js';

describe('guild routes', () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { default: guildRoutes } = await import('../routes/guilds.js');
    app = new Hono();
    app.route('/api/guilds', guildRoutes);
  });

  describe('POST /api/guilds', () => {
    it('should return 401 without auth', async () => {
      const res = await app.request('/api/guilds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test' }),
      });
      expect(res.status).toBe(401);
    });

    it('should return 400 for invalid input', async () => {
      const res = await app.request('/api/guilds', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'X' }), // too short
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/guilds', () => {
    it('should return guild list', async () => {
      (db.query.guilds.findMany as any).mockResolvedValueOnce([
        { id: 'g1', name: 'Guild1', description: null, avatarUrl: null, weeklyXp: 100, totalXp: 500, memberCount: 5, maxMembers: 30 },
      ]);

      const res = await app.request('/api/guilds', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.guilds).toHaveLength(1);
      expect(body.guilds[0].name).toBe('Guild1');
      expect(body.guilds[0].rank).toBe(1);
    });
  });

  describe('GET /api/guilds/mine', () => {
    it('should return null when not in guild', async () => {
      (db.query.guildMembers.findFirst as any).mockResolvedValueOnce(null);

      const res = await app.request('/api/guilds/mine', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.guild).toBeNull();
    });
  });

  describe('GET /api/guilds/:id', () => {
    it('should return 400 for invalid UUID', async () => {
      const res = await app.request('/api/guilds/not-uuid', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent guild', async () => {
      (db.query.guilds.findFirst as any).mockResolvedValueOnce(null);

      const res = await app.request('/api/guilds/00000000-0000-0000-0000-000000000001', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/guilds/:id/join', () => {
    it('should return 400 for invalid guild UUID', async () => {
      const res = await app.request('/api/guilds/bad-id/join', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/guilds/:id/leave', () => {
    it('should return 400 for invalid guild UUID', async () => {
      const res = await app.request('/api/guilds/bad-id/leave', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(400);
    });
  });
});
