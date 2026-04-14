import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../db/index.js', () => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
    },
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
  },
}));

vi.mock('../services/revenueCat.js', () => ({
  getSubscriptionStatus: vi.fn(),
  validateReceipt: vi.fn(),
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(() => ({ userId: 'user-1', email: 'test@test.com' })),
  },
}));

process.env.JWT_SECRET = 'test-secret';

import { db } from '../db/index.js';
import { getSubscriptionStatus, validateReceipt } from '../services/revenueCat.js';

describe('premium routes', () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    delete process.env.REVENUECAT_API_KEY;
    const { default: premiumRoutes } = await import('../routes/premium.js');
    app = new Hono();
    app.route('/api/premium', premiumRoutes);
  });

  describe('POST /api/premium/subscribe', () => {
    it('should return 401 without auth', async () => {
      const res = await app.request('/api/premium/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'ios' }),
      });
      expect(res.status).toBe(401);
    });

    it('should return 400 for missing platform', async () => {
      const res = await app.request('/api/premium/subscribe', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid platform', async () => {
      const res = await app.request('/api/premium/subscribe', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'windows' }),
      });
      expect(res.status).toBe(400);
    });

    it('should auto-activate in dev mode (no REVENUECAT_API_KEY)', async () => {
      const res = await app.request('/api/premium/subscribe', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'ios' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toContain('dev mode');
      expect(body.premiumUntil).toBeDefined();
    });

    it('should validate via RevenueCat when configured', async () => {
      process.env.REVENUECAT_API_KEY = 'test-key';
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      (getSubscriptionStatus as any).mockResolvedValueOnce({
        isActive: true,
        expiresAt,
        productId: 'premium_monthly',
      });

      const res = await app.request('/api/premium/subscribe', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'ios' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.productId).toBe('premium_monthly');
    });

    it('should return 402 when subscription is not active', async () => {
      process.env.REVENUECAT_API_KEY = 'test-key';
      (getSubscriptionStatus as any).mockResolvedValueOnce({
        isActive: false,
        expiresAt: null,
        productId: null,
      });

      const res = await app.request('/api/premium/subscribe', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'android' }),
      });
      expect(res.status).toBe(402);
    });

    it('should accept android platform', async () => {
      const res = await app.request('/api/premium/subscribe', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'android' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toContain('dev mode');
    });

    it('should return 400 when RevenueCat verification throws', async () => {
      process.env.REVENUECAT_API_KEY = 'test-key';
      (getSubscriptionStatus as any).mockRejectedValueOnce(new Error('Network error'));

      const res = await app.request('/api/premium/subscribe', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'ios' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Subscription verification failed');
    });

    it('should recover via receipt when status check fails but receipt provided', async () => {
      process.env.REVENUECAT_API_KEY = 'test-key';
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      // Status check returns inactive
      (getSubscriptionStatus as any).mockResolvedValueOnce({
        isActive: false, expiresAt: null, productId: null,
      });
      // Receipt validation succeeds
      (validateReceipt as any).mockResolvedValueOnce({
        isActive: true, expiresAt, productId: 'premium_monthly',
      });

      const res = await app.request('/api/premium/subscribe', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'ios', receipt: 'valid-receipt-token' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.productId).toBe('premium_monthly');
      expect(validateReceipt).toHaveBeenCalledWith('user-1', 'valid-receipt-token', 'ios');
    });

    it('should return 503 in production without REVENUECAT_API_KEY', async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const res = await app.request('/api/premium/subscribe', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'ios' }),
      });
      expect(res.status).toBe(503);

      process.env.NODE_ENV = origEnv;
    });
  });

  describe('GET /api/premium/status', () => {
    it('should return premium status from DB', async () => {
      (db.query.users.findFirst as any).mockResolvedValueOnce({
        id: 'user-1',
        isPremium: true,
        premiumUntil: new Date(Date.now() + 86400000),
      });

      const res = await app.request('/api/premium/status', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.isPremium).toBe(true);
      expect(body.features).toContain('archive_access');
    });

    it('should return false for expired premium', async () => {
      (db.query.users.findFirst as any).mockResolvedValueOnce({
        id: 'user-1',
        isPremium: true,
        premiumUntil: new Date(Date.now() - 86400000), // expired yesterday
      });

      const res = await app.request('/api/premium/status', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.isPremium).toBe(false);
      expect(body.features).toHaveLength(0);
    });

    it('should return 404 for non-existent user', async () => {
      (db.query.users.findFirst as any).mockResolvedValueOnce(null);

      const res = await app.request('/api/premium/status', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(404);
    });

    it('should sync status from RevenueCat when configured', async () => {
      process.env.REVENUECAT_API_KEY = 'test-key';
      const expiresAt = new Date(Date.now() + 86400000);
      (db.query.users.findFirst as any).mockResolvedValueOnce({
        id: 'user-1',
        isPremium: false,
        premiumUntil: null,
      });
      (getSubscriptionStatus as any).mockResolvedValueOnce({
        isActive: true,
        expiresAt,
        productId: 'premium_monthly',
      });

      const res = await app.request('/api/premium/status', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.isPremium).toBe(true);
      expect(body.features).toContain('ad_free');
    });

    it('should fall back to DB when RevenueCat fails', async () => {
      process.env.REVENUECAT_API_KEY = 'test-key';
      (db.query.users.findFirst as any).mockResolvedValueOnce({
        id: 'user-1',
        isPremium: true,
        premiumUntil: new Date(Date.now() + 86400000),
      });
      (getSubscriptionStatus as any).mockRejectedValueOnce(new Error('RC down'));

      const res = await app.request('/api/premium/status', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.isPremium).toBe(true);
    });
  });
});
