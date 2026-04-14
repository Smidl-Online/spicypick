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
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => [{ id: 'pred-1' }]), onConflictDoNothing: vi.fn() })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => [{ xp: 100 }]) })) })) })),
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => [{ count: 5 }]), innerJoin: vi.fn(() => ({ where: vi.fn(() => []) })) })) })),
  },
}));

vi.mock('../services/gamification.js', () => ({
  calculateVoteXp: vi.fn(() => 15),
  calculateLevel: vi.fn(() => 2),
  checkAchievements: vi.fn(() => []),
}));

vi.mock('../services/analytics.js', () => ({
  analytics: { track: vi.fn(), init: vi.fn() },
}));

vi.mock('../services/pushNotifications.js', () => ({
  sendPushNotification: vi.fn(() => Promise.resolve()),
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(() => ({ userId: 'user-1', email: 'test@test.com' })),
  },
}));

process.env.JWT_SECRET = 'test-secret';

import { db } from '../db/index.js';

describe('prediction routes', () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { default: scenarioRoutes } = await import('../routes/scenarios.js');
    app = new Hono();
    app.route('/api/scenarios', scenarioRoutes);
  });

  describe('POST /api/scenarios/:id/predict', () => {
    it('should return 401 without auth', async () => {
      const res = await app.request('/api/scenarios/00000000-0000-0000-0000-000000000001/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict: 'guilty' }),
      });
      expect(res.status).toBe(401);
    });

    it('should return 400 for invalid verdict', async () => {
      const res = await app.request('/api/scenarios/00000000-0000-0000-0000-000000000001/predict', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict: 'invalid' }),
      });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid scenario UUID', async () => {
      const res = await app.request('/api/scenarios/not-uuid/predict', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict: 'guilty' }),
      });
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent scenario', async () => {
      (db.query.scenarios.findFirst as any).mockResolvedValueOnce(null);

      const res = await app.request('/api/scenarios/00000000-0000-0000-0000-000000000001/predict', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict: 'guilty' }),
      });
      expect(res.status).toBe(404);
    });

    it('should return 404 for draft scenario', async () => {
      (db.query.scenarios.findFirst as any).mockResolvedValueOnce({ id: 'scenario-1', status: 'draft' });

      const res = await app.request('/api/scenarios/00000000-0000-0000-0000-000000000001/predict', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict: 'guilty' }),
      });
      expect(res.status).toBe(404);
    });

    it('should return 409 for duplicate prediction', async () => {
      (db.query.scenarios.findFirst as any).mockResolvedValueOnce({ id: 'scenario-1', status: 'published' });
      (db.query.predictions.findFirst as any).mockResolvedValueOnce({ id: 'pred-1', predictedVerdict: 'guilty' });

      const res = await app.request('/api/scenarios/00000000-0000-0000-0000-000000000001/predict', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict: 'guilty' }),
      });
      expect(res.status).toBe(409);
    });

    it('should return 409 if already voted', async () => {
      (db.query.scenarios.findFirst as any).mockResolvedValueOnce({ id: 'scenario-1', status: 'published' });
      (db.query.predictions.findFirst as any).mockResolvedValueOnce(null);
      (db.query.votes.findFirst as any).mockResolvedValueOnce({ id: 'vote-1', verdict: 'guilty' });

      const res = await app.request('/api/scenarios/00000000-0000-0000-0000-000000000001/predict', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict: 'guilty' }),
      });
      expect(res.status).toBe(409);
    });

    it('should create prediction successfully', async () => {
      (db.query.scenarios.findFirst as any).mockResolvedValueOnce({ id: 'scenario-1', status: 'published' });
      (db.query.predictions.findFirst as any).mockResolvedValueOnce(null);
      (db.query.votes.findFirst as any).mockResolvedValueOnce(null);

      const res = await app.request('/api/scenarios/00000000-0000-0000-0000-000000000001/predict', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict: 'guilty' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.predictionId).toBe('pred-1');
      expect(body.predictedVerdict).toBe('guilty');
    });
  });
});

describe('prediction stats route', () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { default: userRoutes } = await import('../routes/users.js');
    app = new Hono();
    app.route('/api/users', userRoutes);
  });

  describe('GET /api/users/me/prediction-stats', () => {
    it('should return 401 without auth', async () => {
      const res = await app.request('/api/users/me/prediction-stats');
      expect(res.status).toBe(401);
    });
  });
});
