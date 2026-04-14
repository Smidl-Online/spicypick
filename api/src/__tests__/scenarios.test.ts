import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock DB
vi.mock('../db/index.js', () => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
      scenarios: { findFirst: vi.fn(), findMany: vi.fn() },
      votes: { findFirst: vi.fn() },
      predictions: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => [{ id: 'vote-1' }]) })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => [{ xp: 100 }]) })) })) })),
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => [{ count: 5 }]) })) })),
  },
}));

vi.mock('../services/gamification.js', () => ({
  calculateVoteXp: vi.fn(() => 15),
  calculateLevel: vi.fn(() => 2),
  checkAchievements: vi.fn(() => []),
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(() => ({ userId: 'user-1', email: 'test@test.com' })),
  },
}));

process.env.JWT_SECRET = 'test-secret';

import { db } from '../db/index.js';

describe('scenario routes', () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { default: scenarioRoutes } = await import('../routes/scenarios.js');
    app = new Hono();
    app.route('/api/scenarios', scenarioRoutes);
  });

  describe('GET /api/scenarios/today', () => {
    it('should return 401 without auth', async () => {
      const res = await app.request('/api/scenarios/today');
      expect(res.status).toBe(401);
    });

    it('should return null when no scenario today', async () => {
      (db.query.users.findFirst as any).mockResolvedValueOnce({ id: 'user-1', timezone: 'UTC' });
      (db.query.scenarios.findFirst as any).mockResolvedValueOnce(null);

      const res = await app.request('/api/scenarios/today', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.scenario).toBeNull();
    });

    it('should return scenario with voted=false when not voted', async () => {
      const mockScenario = {
        id: 'scenario-1',
        title: 'Test Scenario',
        body: 'Test body',
        category: 'workplace',
        publishDate: new Date().toISOString().split('T')[0],
        status: 'published',
        totalVotes: 10,
      };

      (db.query.users.findFirst as any).mockResolvedValueOnce({ id: 'user-1', timezone: 'UTC' });
      (db.query.scenarios.findFirst as any).mockResolvedValueOnce(mockScenario);
      (db.query.votes.findFirst as any).mockResolvedValueOnce(null);
      (db.query.predictions.findFirst as any).mockResolvedValueOnce(null);

      const res = await app.request('/api/scenarios/today', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.scenario.title).toBe('Test Scenario');
      expect(body.voted).toBe(false);
    });

    it('should return communityStats when already voted', async () => {
      const mockScenario = {
        id: 'scenario-1',
        title: 'Test',
        body: 'Body',
        category: 'workplace',
        expertAnalysis: 'Analysis',
        publishDate: new Date().toISOString().split('T')[0],
        status: 'published',
        totalVotes: 100,
        votesGuilty: 40,
        votesNotGuilty: 30,
        votesComplicated: 20,
        votesBothWrong: 10,
      };

      (db.query.users.findFirst as any).mockResolvedValueOnce({ id: 'user-1', timezone: 'UTC' });
      (db.query.scenarios.findFirst as any).mockResolvedValueOnce(mockScenario);
      (db.query.votes.findFirst as any).mockResolvedValueOnce({ verdict: 'guilty' });
      (db.query.predictions.findFirst as any).mockResolvedValueOnce(null);

      const res = await app.request('/api/scenarios/today', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.voted).toBe(true);
      expect(body.userVerdict).toBe('guilty');
      expect(body.communityStats.total).toBe(100);
    });
  });

  describe('GET /api/scenarios/:id', () => {
    it('should return 400 for invalid UUID', async () => {
      const res = await app.request('/api/scenarios/not-a-uuid', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent scenario', async () => {
      (db.query.scenarios.findFirst as any).mockResolvedValueOnce(null);

      const res = await app.request('/api/scenarios/00000000-0000-0000-0000-000000000001', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/scenarios/archive/list', () => {
    it('should return 403 for non-premium user', async () => {
      (db.query.users.findFirst as any).mockResolvedValueOnce({ id: 'user-1', isPremium: false });

      const res = await app.request('/api/scenarios/archive/list', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(403);
    });

    it('should return 400 for invalid category', async () => {
      (db.query.users.findFirst as any).mockResolvedValueOnce({ id: 'user-1', isPremium: true });

      const res = await app.request('/api/scenarios/archive/list?category=invalid', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/scenarios/:id/vote', () => {
    it('should return 400 for invalid verdict', async () => {
      const res = await app.request('/api/scenarios/00000000-0000-0000-0000-000000000001/vote', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict: 'invalid' }),
      });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid scenario UUID', async () => {
      const res = await app.request('/api/scenarios/not-uuid/vote', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict: 'guilty' }),
      });
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent scenario', async () => {
      (db.query.scenarios.findFirst as any).mockResolvedValueOnce(null);

      const res = await app.request('/api/scenarios/00000000-0000-0000-0000-000000000001/vote', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict: 'guilty' }),
      });
      expect(res.status).toBe(404);
    });

    it('should return 409 for duplicate vote', async () => {
      (db.query.scenarios.findFirst as any).mockResolvedValueOnce({ id: 'scenario-1', status: 'published' });
      (db.query.votes.findFirst as any).mockResolvedValueOnce({ id: 'vote-1', verdict: 'guilty' });

      const res = await app.request('/api/scenarios/00000000-0000-0000-0000-000000000001/vote', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict: 'guilty' }),
      });
      expect(res.status).toBe(409);
    });
  });
});
