import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import crypto from 'crypto';

// ============================================
// Unit tests for experiment hash assignment logic
// (Extracted logic — no DB dependency)
// ============================================

function hashAssign(experimentKey: string, userId: string, variants: string[]): string {
  const hash = crypto
    .createHash('sha256')
    .update(`${experimentKey}:${userId}`)
    .digest('hex');
  const index = parseInt(hash.slice(0, 8), 16) % variants.length;
  return variants[index];
}

function isInTraffic(experimentKey: string, userId: string, trafficPercent: number): boolean {
  if (trafficPercent >= 100) return true;
  const hash = crypto
    .createHash('sha256')
    .update(`traffic:${experimentKey}:${userId}`)
    .digest('hex');
  const value = parseInt(hash.slice(0, 8), 16) % 100;
  return value < trafficPercent;
}

describe('experiments', () => {
  describe('hashAssign', () => {
    it('should return consistent variant for same user/experiment', () => {
      const v1 = hashAssign('test_exp', 'user-123', ['control', 'variant_a']);
      const v2 = hashAssign('test_exp', 'user-123', ['control', 'variant_a']);
      expect(v1).toBe(v2);
    });

    it('should return one of the provided variants', () => {
      const variants = ['control', 'variant_a', 'variant_b'];
      for (let i = 0; i < 100; i++) {
        const result = hashAssign('test_exp', `user-${i}`, variants);
        expect(variants).toContain(result);
      }
    });

    it('should distribute roughly evenly across variants', () => {
      const variants = ['control', 'variant_a'];
      const counts: Record<string, number> = { control: 0, variant_a: 0 };
      const total = 1000;

      for (let i = 0; i < total; i++) {
        const result = hashAssign('distribution_test', `user-${i}`, variants);
        counts[result]++;
      }

      // Each variant should get roughly 50% (allow 40-60% range)
      for (const variant of variants) {
        expect(counts[variant]).toBeGreaterThan(total * 0.4);
        expect(counts[variant]).toBeLessThan(total * 0.6);
      }
    });

    it('should assign different variants for different experiments', () => {
      // For enough users, different experiments should produce different assignments
      let different = 0;
      for (let i = 0; i < 100; i++) {
        const v1 = hashAssign('exp_a', `user-${i}`, ['control', 'variant']);
        const v2 = hashAssign('exp_b', `user-${i}`, ['control', 'variant']);
        if (v1 !== v2) different++;
      }
      // At least some users should get different assignments
      expect(different).toBeGreaterThan(20);
    });
  });

  describe('isInTraffic', () => {
    it('should include all users at 100%', () => {
      for (let i = 0; i < 100; i++) {
        expect(isInTraffic('test_exp', `user-${i}`, 100)).toBe(true);
      }
    });

    it('should exclude all users at 0%', () => {
      for (let i = 0; i < 100; i++) {
        expect(isInTraffic('test_exp', `user-${i}`, 0)).toBe(false);
      }
    });

    it('should include roughly the right percentage', () => {
      let included = 0;
      const total = 1000;
      const target = 50;

      for (let i = 0; i < total; i++) {
        if (isInTraffic('traffic_test', `user-${i}`, target)) {
          included++;
        }
      }

      // Should be roughly 50% (allow 40-60% range)
      expect(included).toBeGreaterThan(total * 0.4);
      expect(included).toBeLessThan(total * 0.6);
    });

    it('should be deterministic for same user', () => {
      const r1 = isInTraffic('test_exp', 'user-42', 50);
      const r2 = isInTraffic('test_exp', 'user-42', 50);
      expect(r1).toBe(r2);
    });
  });

  // ============================================
  // Route-level tests (mocked DB)
  // ============================================
  describe('experiment routes', () => {
    vi.mock('../db/index.js', () => ({
      db: {
        query: {
          experiments: { findFirst: vi.fn(), findMany: vi.fn() },
          experimentAssignments: { findFirst: vi.fn() },
          experimentEvents: { findFirst: vi.fn() },
          users: { findFirst: vi.fn() },
        },
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            onConflictDoNothing: vi.fn(),
          })),
        })),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => [{ count: 0, totalValue: 0 }]),
          })),
        })),
      },
    }));

    vi.mock('jsonwebtoken', () => ({
      default: {
        sign: vi.fn(() => 'mock-jwt-token'),
        verify: vi.fn(() => ({ userId: 'user-1', email: 'test@test.com' })),
      },
    }));

    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

    let app: Hono;

    beforeEach(async () => {
      vi.clearAllMocks();
      const { default: experimentRoutes } = await import('../routes/experiments.js');
      app = new Hono();
      app.route('/api/experiments', experimentRoutes);
    });

    it('GET /me should return 401 without auth', async () => {
      const res = await app.request('/api/experiments/me');
      expect(res.status).toBe(401);
    });

    it('GET /me should return experiments for authenticated user', async () => {
      const { db } = await import('../db/index.js');
      (db.query.experiments.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const res = await app.request('/api/experiments/me', {
        headers: { Authorization: 'Bearer mock-jwt-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('experiments');
    });

    it('POST /track should return 401 without auth', async () => {
      const res = await app.request('/api/experiments/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experimentKey: 'test', eventType: 'conversion' }),
      });
      expect(res.status).toBe(401);
    });

    it('POST /track should return 400 for invalid input', async () => {
      const res = await app.request('/api/experiments/track', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer mock-jwt-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });
  });
});
