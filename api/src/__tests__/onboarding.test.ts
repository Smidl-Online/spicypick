import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateSetWhere = vi.fn();

// Mock DB before importing routes
vi.mock('../db/index.js', () => ({
  db: {
    query: {
      users: { findFirst: mockFindFirst, findMany: vi.fn() },
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
  onboardingCompleted: false,
  locale: 'en',
  timezone: 'Europe/Prague',
  birthYear: null,
  country: null,
  gender: null,
  createdAt: new Date(),
  pushToken: null,
  notifDaily: true,
  notifStreak: true,
  notifLeague: true,
  notifChallenges: true,
  notifAchievements: true,
};

describe('onboarding', () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockUpdateSetWhere.mockResolvedValue([]);
    mockUpdateSet.mockReturnValue({ where: mockUpdateSetWhere });
    mockUpdate.mockReturnValue({ set: mockUpdateSet });

    const { default: userRoutes } = await import('../routes/users.js');
    app = new Hono();
    app.route('/api/users', userRoutes);
  });

  describe('POST /api/users/me/onboarding-complete', () => {
    it('should set onboarding_completed to true and return 200', async () => {
      mockFindFirst.mockResolvedValue(mockUser);

      const res = await app.request('/api/users/me/onboarding-complete', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(res.status).toBe(200);
      const body = await res.json() as { message: string };
      expect(body.message).toBe('Onboarding completed');

      // Verify DB update was called with correct fields
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ onboardingCompleted: true }),
      );
    });

    it('should return 401 without auth token', async () => {
      const res = await app.request('/api/users/me/onboarding-complete', {
        method: 'POST',
      });

      expect(res.status).toBe(401);
    });

    it('should be idempotent — can be called multiple times', async () => {
      const completedUser = { ...mockUser, onboardingCompleted: true };
      mockFindFirst.mockResolvedValue(completedUser);

      const res = await app.request('/api/users/me/onboarding-complete', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/users/me includes onboardingCompleted', () => {
    it('should include onboardingCompleted=false for new user', async () => {
      mockFindFirst.mockResolvedValue(mockUser);
      const mockSelect = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 5 }]),
        }),
      };
      const { db } = await import('../db/index.js');
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue(mockSelect);

      const res = await app.request('/api/users/me', {
        method: 'GET',
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body).toHaveProperty('onboardingCompleted', false);
    });

    it('should include onboardingCompleted=true after completion', async () => {
      const completedUser = { ...mockUser, onboardingCompleted: true };
      mockFindFirst.mockResolvedValue(completedUser);
      const mockSelect = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 10 }]),
        }),
      };
      const { db } = await import('../db/index.js');
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue(mockSelect);

      const res = await app.request('/api/users/me', {
        method: 'GET',
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body).toHaveProperty('onboardingCompleted', true);
    });
  });
});
