import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock DB
vi.mock('../db/index.js', () => ({
  db: {
    query: {
      scenarios: { findFirst: vi.fn(), findMany: vi.fn(() => []) },
      scenarioSubmissions: { findFirst: vi.fn(), findMany: vi.fn(() => []) },
      users: { findFirst: vi.fn() },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => [{ total: 5, drafts: 1, scheduled: 1, published: 2, archived: 1, pending: 0 }]),
    })),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => [{ id: 'new-id' }]) })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    transaction: vi.fn(async (fn: Function) => fn({
      insert: vi.fn(() => ({ values: vi.fn() })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    })),
  },
}));

vi.mock('../services/scenarioGenerator.js', () => ({
  generateAndSaveScenario: vi.fn(() => Promise.resolve({
    title: 'Test scenario',
    body: 'Test body',
    category: 'workplace',
  })),
}));

process.env.ADMIN_TOKEN = 'test-admin-token';

import { db } from '../db/index.js';

describe('admin routes', () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { default: adminRoutes } = await import('../routes/admin.js');
    app = new Hono();
    app.route('/admin', adminRoutes);
  });

  describe('authentication', () => {
    it('should show login page for unauthenticated GET requests', async () => {
      const res = await app.request('/admin');
      const html = await res.text();
      expect(html).toContain('Admin Login');
      expect(html).toContain('method="POST"');
    });

    it('should return 403 for unauthenticated POST requests', async () => {
      const res = await app.request('/admin/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'title=test',
      });
      expect(res.status).toBe(403);
    });

    it('should NOT accept token via query string', async () => {
      const res = await app.request('/admin?token=test-admin-token');
      const html = await res.text();
      // Should still show login page because query string auth is removed
      expect(html).toContain('Admin Login');
    });

    it('should accept token via header', async () => {
      // Mock DB responses for dashboard
      (db.select as any).mockImplementation(() => ({
        from: vi.fn(() => [{ total: 5, drafts: 1, scheduled: 1, published: 2, archived: 1, pending: 0 }]),
      }));

      const res = await app.request('/admin', {
        headers: { 'ADMIN_TOKEN': 'test-admin-token' },
      });
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Dashboard');
    });

    it('should block when ADMIN_TOKEN is not configured', async () => {
      const saved = process.env.ADMIN_TOKEN;
      delete process.env.ADMIN_TOKEN;

      const { default: adminRoutes } = await import('../routes/admin.js');
      const testApp = new Hono();
      testApp.route('/admin', adminRoutes);

      const res = await testApp.request('/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'token=anything',
      });
      expect(res.status).toBe(403);

      process.env.ADMIN_TOKEN = saved;
    });
  });

  describe('POST /admin/login', () => {
    it('should set cookie for valid token', async () => {
      const res = await app.request('/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'token=test-admin-token',
      });
      expect(res.status).toBe(302);
      expect(res.headers.get('set-cookie')).toContain('admin_token');
    });

    it('should reject invalid token', async () => {
      const res = await app.request('/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'token=wrong-token',
      });
      expect(res.status).toBe(403);
    });
  });

  describe('POST /admin/submissions/:id/reject', () => {
    it('should reject only pending submissions', async () => {
      (db.query.scenarioSubmissions.findFirst as any).mockResolvedValueOnce({
        id: 'sub-1',
        status: 'approved',
      });

      const res = await app.request('/admin/submissions/00000000-0000-0000-0000-000000000001/reject', {
        method: 'POST',
        headers: {
          'ADMIN_TOKEN': 'test-admin-token',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'moderatorNotes=test',
      });
      expect(res.status).toBe(409);
    });

    it('should return 400 for invalid UUID', async () => {
      const res = await app.request('/admin/submissions/not-a-uuid/reject', {
        method: 'POST',
        headers: {
          'ADMIN_TOKEN': 'test-admin-token',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'moderatorNotes=test',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /admin/scenarios/:id/status', () => {
    it('should auto-set publishDate when publishing', async () => {
      (db.query.scenarios.findFirst as any).mockResolvedValueOnce({
        id: 'scenario-1',
        publishDate: null,
      });

      const updateMock = vi.fn(() => ({ where: vi.fn() }));
      (db.update as any).mockReturnValueOnce({ set: updateMock });

      const res = await app.request('/admin/scenarios/00000000-0000-0000-0000-000000000001/status', {
        method: 'POST',
        headers: {
          'ADMIN_TOKEN': 'test-admin-token',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'status=published',
      });
      expect(res.status).toBe(302);

      // Verify update was called with publishDate
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ publishDate: expect.any(String) }),
      );
    });

    it('should reject invalid status', async () => {
      const res = await app.request('/admin/scenarios/00000000-0000-0000-0000-000000000001/status', {
        method: 'POST',
        headers: {
          'ADMIN_TOKEN': 'test-admin-token',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'status=invalid',
      });
      expect(res.status).toBe(400);
    });
  });
});
