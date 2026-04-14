import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock DB
vi.mock('../db/index.js', () => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
      moralProfiles: { findFirst: vi.fn() },
    },
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => [{ id: 'profile-1' }]) })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => []) })) })) })),
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => [{ count: 25 }]), innerJoin: vi.fn() })) })),
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(() => ({ userId: 'user-1', email: 'test@test.com' })),
  },
}));

process.env.JWT_SECRET = 'test-secret';

import { db } from '../db/index.js';
import { calculateDimensions, type VoteWithScenario } from '../services/moralProfileCalculator.js';

describe('moral profile', () => {
  describe('calculateDimensions', () => {
    function makeVote(
      verdict: string,
      category: string,
      majorityVerdict?: string,
    ): VoteWithScenario {
      const votesGuilty = majorityVerdict === 'guilty' ? 50 : 5;
      const votesNotGuilty = majorityVerdict === 'not_guilty' ? 50 : 5;
      const votesComplicated = majorityVerdict === 'complicated' ? 50 : 5;
      const votesBothWrong = majorityVerdict === 'both_wrong' ? 50 : 5;
      return {
        verdict,
        scenarioId: `scenario-${Math.random()}`,
        category,
        totalVotes: votesGuilty + votesNotGuilty + votesComplicated + votesBothWrong,
        votesGuilty,
        votesNotGuilty,
        votesComplicated,
        votesBothWrong,
      };
    }

    it('should calculate forgiving as not_guilty ratio', () => {
      const votes: VoteWithScenario[] = [
        ...Array(7).fill(null).map(() => makeVote('not_guilty', 'workplace')),
        ...Array(3).fill(null).map(() => makeVote('guilty', 'workplace')),
      ];
      const result = calculateDimensions(votes);
      expect(result.forgiving).toBe(70);
    });

    it('should calculate confrontational as both_wrong ratio', () => {
      const votes: VoteWithScenario[] = [
        ...Array(4).fill(null).map(() => makeVote('both_wrong', 'workplace')),
        ...Array(6).fill(null).map(() => makeVote('guilty', 'workplace')),
      ];
      const result = calculateDimensions(votes);
      expect(result.confrontational).toBe(40);
    });

    it('should calculate pragmatic as complicated ratio', () => {
      const votes: VoteWithScenario[] = [
        ...Array(8).fill(null).map(() => makeVote('complicated', 'family')),
        ...Array(2).fill(null).map(() => makeVote('guilty', 'family')),
      ];
      const result = calculateDimensions(votes);
      expect(result.pragmatic).toBe(80);
    });

    it('should calculate majorityAligned correctly', () => {
      const votes: VoteWithScenario[] = [
        ...Array(6).fill(null).map(() => makeVote('guilty', 'workplace', 'guilty')),
        ...Array(4).fill(null).map(() => makeVote('not_guilty', 'workplace', 'guilty')),
      ];
      const result = calculateDimensions(votes);
      expect(result.majorityAligned).toBe(60);
    });

    it('should clamp values to 0-100', () => {
      const votes: VoteWithScenario[] = Array(10).fill(null).map(() =>
        makeVote('not_guilty', 'workplace'),
      );
      const result = calculateDimensions(votes);
      expect(result.forgiving).toBe(100);
      expect(result.forgiving).toBeLessThanOrEqual(100);
      expect(result.forgiving).toBeGreaterThanOrEqual(0);
    });

    it('should handle all same verdicts', () => {
      const votes: VoteWithScenario[] = Array(20).fill(null).map(() =>
        makeVote('guilty', 'workplace', 'guilty'),
      );
      const result = calculateDimensions(votes);
      expect(result.forgiving).toBe(0);
      expect(result.confrontational).toBe(0);
      expect(result.pragmatic).toBe(0);
      expect(result.majorityAligned).toBe(100);
    });

    it('should return moderate empathetic with single category', () => {
      const votes: VoteWithScenario[] = Array(10).fill(null).map(() =>
        makeVote('guilty', 'neighbors'),
      );
      const result = calculateDimensions(votes);
      // Neighbors is neither emotional nor rational, so both rates default to 0.5
      expect(result.empathetic).toBe(50);
    });

    it('should calculate empathetic based on emotional vs rational categories', () => {
      const votes: VoteWithScenario[] = [
        // Emotional categories: very forgiving
        ...Array(5).fill(null).map(() => makeVote('not_guilty', 'relationship')),
        ...Array(5).fill(null).map(() => makeVote('not_guilty', 'family')),
        // Rational categories: strict
        ...Array(5).fill(null).map(() => makeVote('guilty', 'workplace')),
        ...Array(5).fill(null).map(() => makeVote('guilty', 'money')),
      ];
      const result = calculateDimensions(votes);
      // emotionalRate = 1.0, rationalRate = 0.0 => empathetic = ((1-0+1)/2)*100 = 100
      expect(result.empathetic).toBe(100);
    });

    it('should calculate consistent with same behavior across categories', () => {
      // All categories with same verdict distribution = highly consistent
      const votes: VoteWithScenario[] = [
        ...Array(3).fill(null).map(() => makeVote('guilty', 'workplace')),
        ...Array(3).fill(null).map(() => makeVote('guilty', 'relationship')),
        ...Array(3).fill(null).map(() => makeVote('guilty', 'family')),
        ...Array(3).fill(null).map(() => makeVote('guilty', 'money')),
      ];
      const result = calculateDimensions(votes);
      // All categories have 100% guilty => dominant ratios all 1.0, stdDev = 0
      expect(result.consistent).toBe(100);
    });

    it('should return lower consistent with varied behavior across categories', () => {
      const votes: VoteWithScenario[] = [
        // Workplace: 100% guilty
        ...Array(5).fill(null).map(() => makeVote('guilty', 'workplace')),
        // Relationship: 100% not_guilty
        ...Array(5).fill(null).map(() => makeVote('not_guilty', 'relationship')),
        // Family: mixed
        makeVote('guilty', 'family'),
        makeVote('not_guilty', 'family'),
        makeVote('complicated', 'family'),
        makeVote('both_wrong', 'family'),
        makeVote('guilty', 'family'),
      ];
      const result = calculateDimensions(votes);
      // Workplace: 100% guilty, Relationship: 100% not_guilty, Family: mixed
      // Very different verdict distributions across categories => low consistency
      expect(result.consistent).toBeLessThan(50);
    });

    it('should detect inconsistency when same dominance but opposite verdicts', () => {
      // This was the bug: old algo measured dominance ratio only, so both categories
      // at 100% dominance would score consistent=100 even with opposite verdicts
      const votes: VoteWithScenario[] = [
        ...Array(5).fill(null).map(() => makeVote('guilty', 'workplace')),
        ...Array(5).fill(null).map(() => makeVote('not_guilty', 'relationship')),
      ];
      const result = calculateDimensions(votes);
      // Completely opposite behavior => very low consistency
      expect(result.consistent).toBeLessThan(30);
    });
  });

  describe('GET /api/users/me/moral-profile', () => {
    let app: Hono;

    beforeEach(async () => {
      vi.clearAllMocks();
      const { default: userRoutes } = await import('../routes/users.js');
      app = new Hono();
      app.route('/api/users', userRoutes);
    });

    it('should return 401 without auth', async () => {
      const res = await app.request('/api/users/me/moral-profile');
      expect(res.status).toBe(401);
    });

    it('should return not ready when profile does not exist', async () => {
      (db.query.moralProfiles.findFirst as any).mockResolvedValueOnce(null);
      (db.select as any).mockReturnValueOnce({
        from: vi.fn(() => ({ where: vi.fn(() => [{ count: 5 }]) })),
      });

      const res = await app.request('/api/users/me/moral-profile', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.isReady).toBe(false);
      expect(body.profile).toBeNull();
      expect(body.votesUntilReady).toBe(5);
    });

    it('should return profile when ready', async () => {
      const mockProfile = {
        userId: 'user-1',
        forgiving: 73,
        pragmatic: 82,
        empathetic: 61,
        confrontational: 45,
        majorityAligned: 58,
        consistent: 70,
        totalVotesAnalyzed: 47,
        lastCalculatedAt: new Date().toISOString(),
      };
      (db.query.moralProfiles.findFirst as any).mockResolvedValueOnce(mockProfile);
      (db.select as any).mockReturnValueOnce({
        from: vi.fn(() => ({ where: vi.fn(() => [{ count: 47 }]) })),
      });

      const res = await app.request('/api/users/me/moral-profile', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.isReady).toBe(true);
      expect(body.profile.forgiving).toBe(73);
      expect(body.profile.pragmatic).toBe(82);
      expect(body.profile.empathetic).toBe(61);
      expect(body.profile.confrontational).toBe(45);
      expect(body.profile.majorityAligned).toBe(58);
      expect(body.profile.consistent).toBe(70);
      expect(body.totalVotesAnalyzed).toBe(47);
    });

    it('should return not ready when votes < minimum', async () => {
      (db.query.moralProfiles.findFirst as any).mockResolvedValueOnce(null);
      (db.select as any).mockReturnValueOnce({
        from: vi.fn(() => ({ where: vi.fn(() => [{ count: 3 }]) })),
      });

      const res = await app.request('/api/users/me/moral-profile', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.isReady).toBe(false);
      expect(body.votesUntilReady).toBe(7);
    });

    it('should return not ready when exactly at 0 votes', async () => {
      (db.query.moralProfiles.findFirst as any).mockResolvedValueOnce(null);
      (db.select as any).mockReturnValueOnce({
        from: vi.fn(() => ({ where: vi.fn(() => [{ count: 0 }]) })),
      });

      const res = await app.request('/api/users/me/moral-profile', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.isReady).toBe(false);
      expect(body.votesUntilReady).toBe(10);
    });
  });
});
