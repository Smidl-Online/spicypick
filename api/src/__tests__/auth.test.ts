import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock DB before importing routes
vi.mock('../db/index.js', () => ({
  db: {
    query: {
      users: { findFirst: vi.fn(), findMany: vi.fn() },
      votes: { findFirst: vi.fn(), findMany: vi.fn() },
      userAchievements: { findFirst: vi.fn(), findMany: vi.fn() },
      scenarioSubmissions: { findFirst: vi.fn(), findMany: vi.fn() },
      challenges: { findFirst: vi.fn(), findMany: vi.fn() },
      guildMembers: { findFirst: vi.fn(), findMany: vi.fn() },
      refreshTokens: { findFirst: vi.fn() },
    },
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => [{ id: 'user-1', email: 'test@test.com', username: 'testuser' }]), onConflictDoNothing: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
    select: vi.fn(() => ({ from: vi.fn() })),
  },
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(() => Promise.resolve('$hashed$')),
    compare: vi.fn(() => Promise.resolve(true)),
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(() => 'mock-jwt-token'),
    verify: vi.fn(() => ({ userId: 'user-1', email: 'test@test.com' })),
  },
}));

// Set env vars before importing
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

import { db } from '../db/index.js';

describe('auth routes', () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-import to get fresh routes
    const { default: authRoutes } = await import('../routes/auth.js');
    app = new Hono();
    app.route('/api/auth', authRoutes);
  });

  describe('POST /api/auth/register', () => {
    it('should return 400 for invalid input', async () => {
      const res = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-email', username: 'ab', password: '123' }),
      });
      expect(res.status).toBe(400);
    });

    it('should return 409 for duplicate email', async () => {
      (db.query.users.findFirst as any).mockResolvedValueOnce({ id: 'existing', email: 'test@test.com' });

      const res = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@test.com', username: 'testuser', password: 'password123' }),
      });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toContain('Email');
    });

    it('should return 201 for valid registration', async () => {
      (db.query.users.findFirst as any)
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce(null); // username check

      const res = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'new@test.com', username: 'newuser', password: 'password123' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.user).toBeDefined();
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    it('should return 400 for invalid input', async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-email' }),
      });
      expect(res.status).toBe(400);
    });

    it('should return 401 for wrong email', async () => {
      (db.query.users.findFirst as any).mockResolvedValueOnce(null);

      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'wrong@test.com', password: 'password123' }),
      });
      expect(res.status).toBe(401);
    });

    it('should return tokens for valid login', async () => {
      (db.query.users.findFirst as any).mockResolvedValueOnce({
        id: 'user-1',
        email: 'test@test.com',
        username: 'testuser',
        passwordHash: '$hashed$',
      });

      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@test.com', password: 'password123' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.accessToken).toBeDefined();
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should return 200 (stub — does not reveal if email exists)', async () => {
      const res = await app.request('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'any@test.com' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toContain('password reset email sent');
    });
  });

  describe('DELETE /api/auth/account', () => {
    it('should return 401 without auth', async () => {
      const res = await app.request('/api/auth/account', { method: 'DELETE' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/export', () => {
    it('should return 401 without auth', async () => {
      const res = await app.request('/api/auth/export');
      expect(res.status).toBe(401);
    });
  });
});
