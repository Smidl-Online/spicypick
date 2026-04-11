import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../db/index.js', () => ({
  db: {
    query: {
      leagueMembers: { findFirst: vi.fn(), findMany: vi.fn() },
    },
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(() => ({ userId: 'user-1', email: 'test@test.com' })),
  },
}));

process.env.JWT_SECRET = 'test-secret';

import { db } from '../db/index.js';

describe('league routes', () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { default: leagueRoutes } = await import('../routes/leagues.js');
    app = new Hono();
    app.route('/api/leagues', leagueRoutes);
  });

  describe('GET /api/leagues/current', () => {
    it('should return 401 without auth', async () => {
      const res = await app.request('/api/leagues/current');
      expect(res.status).toBe(401);
    });

    it('should return null when not in a league', async () => {
      (db.query.leagueMembers.findFirst as any).mockResolvedValueOnce(null);

      const res = await app.request('/api/leagues/current', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.league).toBeNull();
    });

    it('should return league with leaderboard', async () => {
      const mockMembership = {
        leagueId: 'league-1',
        userId: 'user-1',
        weeklyXp: 50,
        league: { id: 'league-1', tier: 'silver', weekStart: '2026-04-07', weekEnd: '2026-04-13' },
      };
      (db.query.leagueMembers.findFirst as any).mockResolvedValueOnce(mockMembership);
      (db.query.leagueMembers.findMany as any).mockResolvedValueOnce([
        { userId: 'user-2', weeklyXp: 100, user: { username: 'top', avatarUrl: null } },
        { userId: 'user-1', weeklyXp: 50, user: { username: 'me', avatarUrl: null } },
      ]);

      const res = await app.request('/api/leagues/current', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.league.tier).toBe('silver');
      expect(body.leaderboard).toHaveLength(2);
      expect(body.userRank).toBe(2);
    });
  });

  describe('GET /api/leagues/history', () => {
    it('should return 401 without auth', async () => {
      const res = await app.request('/api/leagues/history');
      expect(res.status).toBe(401);
    });

    it('should return empty history', async () => {
      (db.query.leagueMembers.findMany as any).mockResolvedValueOnce([]);

      const res = await app.request('/api/leagues/history', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.history).toHaveLength(0);
    });

    it('should return league history with pagination', async () => {
      (db.query.leagueMembers.findMany as any).mockResolvedValueOnce([
        {
          leagueId: 'l-1', league: { tier: 'gold', weekStart: '2026-04-07', weekEnd: '2026-04-13' },
          weeklyXp: 200, finalRank: 3, promoted: true, demoted: false,
        },
      ]);

      const res = await app.request('/api/leagues/history?page=1&limit=10', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.history[0].tier).toBe('gold');
      expect(body.history[0].promoted).toBe(true);
    });
  });
});
