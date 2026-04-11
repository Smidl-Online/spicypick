import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../db/index.js', () => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
      scenarios: { findFirst: vi.fn() },
      votes: { findFirst: vi.fn() },
      challenges: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => [{
      id: 'challenge-1', challengerId: 'user-1', challengedId: 'user-2',
      scenarioId: 'scenario-1', status: 'pending',
    }]) })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => [{ id: 'ch-1', status: 'completed' }]) })) })) })),
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(() => ({ userId: 'user-1', email: 'test@test.com' })),
  },
}));

process.env.JWT_SECRET = 'test-secret';

import { db } from '../db/index.js';

describe('challenge routes', () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { default: challengeRoutes } = await import('../routes/challenges.js');
    app = new Hono();
    app.route('/api/challenges', challengeRoutes);
  });

  describe('POST /api/challenges', () => {
    it('should return 401 without auth', async () => {
      const res = await app.request('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengedUsername: 'user2', scenarioId: '00000000-0000-0000-0000-000000000001' }),
      });
      expect(res.status).toBe(401);
    });

    it('should return 400 for invalid input', async () => {
      const res = await app.request('/api/challenges', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengedUsername: 'user2' }), // missing scenarioId
      });
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent user', async () => {
      (db.query.users.findFirst as any).mockResolvedValueOnce(null);

      const res = await app.request('/api/challenges', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengedUsername: 'nobody', scenarioId: '00000000-0000-0000-0000-000000000001' }),
      });
      expect(res.status).toBe(404);
    });

    it('should return 400 when challenging yourself', async () => {
      (db.query.users.findFirst as any).mockResolvedValueOnce({ id: 'user-1', username: 'self' });

      const res = await app.request('/api/challenges', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengedUsername: 'self', scenarioId: '00000000-0000-0000-0000-000000000001' }),
      });
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent scenario', async () => {
      (db.query.users.findFirst as any).mockResolvedValueOnce({ id: 'user-2', username: 'other' });
      (db.query.scenarios.findFirst as any).mockResolvedValueOnce(null);

      const res = await app.request('/api/challenges', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengedUsername: 'other', scenarioId: '00000000-0000-0000-0000-000000000001' }),
      });
      expect(res.status).toBe(404);
    });

    it('should create challenge successfully', async () => {
      (db.query.users.findFirst as any).mockResolvedValueOnce({ id: 'user-2', username: 'other' });
      (db.query.scenarios.findFirst as any).mockResolvedValueOnce({ id: 'scenario-1', title: 'Test' });
      (db.query.votes.findFirst as any).mockResolvedValueOnce({ verdict: 'guilty' });

      const res = await app.request('/api/challenges', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengedUsername: 'other', scenarioId: '00000000-0000-0000-0000-000000000001' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.challenge).toBeDefined();
    });
  });

  describe('GET /api/challenges', () => {
    it('should return user challenges', async () => {
      (db.query.challenges.findMany as any).mockResolvedValueOnce([
        {
          id: 'ch-1', challengerId: 'user-1', challengedId: 'user-2',
          challengerVerdict: 'guilty', challengedVerdict: null, status: 'pending',
          createdAt: new Date(),
          challenger: { id: 'user-1', username: 'me', avatarUrl: null },
          challenged: { id: 'user-2', username: 'other', avatarUrl: null },
          scenario: { id: 's-1', title: 'Test', category: 'workplace' },
        },
      ]);

      const res = await app.request('/api/challenges', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.challenges).toHaveLength(1);
      expect(body.challenges[0].isChallenger).toBe(true);
    });
  });

  describe('POST /api/challenges/:id/respond', () => {
    it('should return 400 for invalid UUID', async () => {
      const res = await app.request('/api/challenges/bad-id/respond', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict: 'guilty' }),
      });
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent challenge', async () => {
      (db.query.challenges.findFirst as any).mockResolvedValueOnce(null);

      const res = await app.request('/api/challenges/00000000-0000-0000-0000-000000000001/respond', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict: 'guilty' }),
      });
      expect(res.status).toBe(404);
    });

    it('should return 403 when not the challenged user', async () => {
      (db.query.challenges.findFirst as any).mockResolvedValueOnce({
        id: 'ch-1', challengedId: 'user-99', status: 'pending',
      });

      const res = await app.request('/api/challenges/00000000-0000-0000-0000-000000000001/respond', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict: 'guilty' }),
      });
      expect(res.status).toBe(404);
    });

    it('should return 400 for already completed challenge', async () => {
      (db.query.challenges.findFirst as any).mockResolvedValueOnce({
        id: 'ch-1', challengedId: 'user-1', status: 'completed',
      });

      const res = await app.request('/api/challenges/00000000-0000-0000-0000-000000000001/respond', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict: 'guilty' }),
      });
      expect(res.status).toBe(400);
    });

    it('should complete challenge successfully', async () => {
      (db.query.challenges.findFirst as any).mockResolvedValueOnce({
        id: 'ch-1', challengedId: 'user-1', challengerVerdict: 'guilty', status: 'pending',
      });

      const res = await app.request('/api/challenges/00000000-0000-0000-0000-000000000001/respond', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict: 'guilty' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.match).toBe(true);
    });
  });
});
