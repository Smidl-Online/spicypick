import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateSetWhere = vi.fn();

// Mock DB before importing routes
vi.mock('../db/index.js', () => ({
  db: {
    query: {
      users: { findFirst: mockFindFirst, findMany: mockFindMany },
      votes: { findFirst: vi.fn(), findMany: vi.fn() },
      userAchievements: { findFirst: vi.fn(), findMany: vi.fn() },
      scenarioSubmissions: { findFirst: vi.fn(), findMany: vi.fn() },
      challenges: { findFirst: vi.fn(), findMany: vi.fn() },
      guildMembers: { findFirst: vi.fn(), findMany: vi.fn() },
      refreshTokens: { findFirst: vi.fn() },
      moralProfiles: { findFirst: vi.fn() },
      predictions: { findFirst: vi.fn() },
    },
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => []), onConflictDoNothing: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => [{ count: 0 }]) })) })),
    update: mockUpdate,
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(() => ({ userId: 'user-1', email: 'test@test.com' })),
  },
}));

process.env.JWT_SECRET = 'test-secret';

const mockUser = {
  id: 'user-1',
  email: 'test@test.com',
  username: 'testuser',
  avatarUrl: null,
  xp: 100,
  level: 2,
  currentStreak: 5,
  longestStreak: 10,
  streakFreezes: 1,
  lastPlayedAt: '2026-04-14',
  isPremium: false,
  premiumUntil: null,
  locale: 'en',
  timezone: 'Europe/Prague',
  birthYear: null,
  country: null,
  gender: null,
  totalVotes: 42,
  createdAt: new Date(),
  pushToken: 'ExponentPushToken[abc123]',
  notifDaily: true,
  notifStreak: true,
  notifLeague: true,
  notifChallenges: true,
  notifAchievements: true,
};

describe('push token & notification preferences', () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Setup default update chain mock
    mockUpdateSetWhere.mockResolvedValue({ returning: vi.fn(() => []) });
    mockUpdateSet.mockReturnValue({ where: mockUpdateSetWhere });
    mockUpdate.mockReturnValue({ set: mockUpdateSet });

    const { default: userRoutes } = await import('../routes/users.js');
    app = new Hono();
    app.route('/api/users', userRoutes);
  });

  describe('PUT /api/users/me/push-token', () => {
    it('should save push token', async () => {
      const res = await app.request('/api/users/me/push-token', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
        body: JSON.stringify({ token: 'ExponentPushToken[xyz789]' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('Push token saved');
    });

    it('should reject missing token', async () => {
      const res = await app.request('/api/users/me/push-token', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it('should reject invalid JSON', async () => {
      const res = await app.request('/api/users/me/push-token', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
        body: 'not json',
      });
      expect(res.status).toBe(400);
    });

    it('should return 401 without auth', async () => {
      const res = await app.request('/api/users/me/push-token', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'ExponentPushToken[xyz]' }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/users/me/push-token', () => {
    it('should clear push token', async () => {
      const res = await app.request('/api/users/me/push-token', {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer mock-token',
        },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('Push token cleared');
      // Verify update was called with null token
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ pushToken: null }),
      );
    });

    it('should return 401 without auth', async () => {
      const res = await app.request('/api/users/me/push-token', {
        method: 'DELETE',
      });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/users/me/notification-preferences', () => {
    it('should return notification preferences', async () => {
      mockFindFirst.mockResolvedValueOnce(mockUser);
      const res = await app.request('/api/users/me/notification-preferences', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        daily: true,
        streak: true,
        league: true,
        challenges: true,
        achievements: true,
      });
    });

    it('should return user with some prefs disabled', async () => {
      mockFindFirst.mockResolvedValueOnce({ ...mockUser, notifDaily: false, notifLeague: false });
      const res = await app.request('/api/users/me/notification-preferences', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.daily).toBe(false);
      expect(data.streak).toBe(true);
      expect(data.league).toBe(false);
    });

    it('should return 404 for missing user', async () => {
      mockFindFirst.mockResolvedValueOnce(null);
      const res = await app.request('/api/users/me/notification-preferences', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(404);
    });

    it('should return 401 without auth', async () => {
      const res = await app.request('/api/users/me/notification-preferences');
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/users/me/notification-preferences', () => {
    it('should update single preference', async () => {
      // After update, findFirst returns updated user
      mockFindFirst.mockResolvedValueOnce({ ...mockUser, notifDaily: false });
      const res = await app.request('/api/users/me/notification-preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
        body: JSON.stringify({ daily: false }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.daily).toBe(false);
      expect(data.streak).toBe(true);
    });

    it('should update multiple preferences', async () => {
      mockFindFirst.mockResolvedValueOnce({ ...mockUser, notifDaily: false, notifStreak: false });
      const res = await app.request('/api/users/me/notification-preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
        body: JSON.stringify({ daily: false, streak: false }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.daily).toBe(false);
      expect(data.streak).toBe(false);
      expect(data.league).toBe(true);
    });

    it('should reject invalid input types', async () => {
      const res = await app.request('/api/users/me/notification-preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
        body: JSON.stringify({ daily: 'not-a-boolean' }),
      });
      expect(res.status).toBe(400);
    });

    it('should reject invalid JSON', async () => {
      const res = await app.request('/api/users/me/notification-preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
        body: 'not json',
      });
      expect(res.status).toBe(400);
    });

    it('should return 401 without auth', async () => {
      const res = await app.request('/api/users/me/notification-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daily: false }),
      });
      expect(res.status).toBe(401);
    });
  });
});
