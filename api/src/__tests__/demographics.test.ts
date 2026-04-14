import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock DB
vi.mock('../db/index.js', () => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
      scenarios: { findFirst: vi.fn() },
      votes: { findFirst: vi.fn() },
      moralProfiles: { findFirst: vi.fn() },
    },
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => [{ id: 'vote-1' }]), onConflictDoUpdate: vi.fn() })), onConflictDoUpdate: vi.fn() })),
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
import {
  calculateAgeGroup,
  isValidGender,
  isValidCountry,
  isValidBirthYear,
  K_ANONYMITY_THRESHOLD,
} from '../services/demographics.js';

describe('demographics', () => {
  describe('calculateAgeGroup', () => {
    const currentYear = new Date().getFullYear();

    it('should return null for age < 13', () => {
      expect(calculateAgeGroup(currentYear - 10)).toBeNull();
    });

    it('should return 13-17 for ages 13-17', () => {
      expect(calculateAgeGroup(currentYear - 13)).toBe('13-17');
      expect(calculateAgeGroup(currentYear - 17)).toBe('13-17');
    });

    it('should return 18-24 for ages 18-24', () => {
      expect(calculateAgeGroup(currentYear - 18)).toBe('18-24');
      expect(calculateAgeGroup(currentYear - 24)).toBe('18-24');
    });

    it('should return 25-34 for ages 25-34', () => {
      expect(calculateAgeGroup(currentYear - 25)).toBe('25-34');
      expect(calculateAgeGroup(currentYear - 34)).toBe('25-34');
    });

    it('should return 35-44 for ages 35-44', () => {
      expect(calculateAgeGroup(currentYear - 35)).toBe('35-44');
      expect(calculateAgeGroup(currentYear - 44)).toBe('35-44');
    });

    it('should return 45-54 for ages 45-54', () => {
      expect(calculateAgeGroup(currentYear - 45)).toBe('45-54');
      expect(calculateAgeGroup(currentYear - 54)).toBe('45-54');
    });

    it('should return 55-64 for ages 55-64', () => {
      expect(calculateAgeGroup(currentYear - 55)).toBe('55-64');
      expect(calculateAgeGroup(currentYear - 64)).toBe('55-64');
    });

    it('should return 65+ for ages >= 65', () => {
      expect(calculateAgeGroup(currentYear - 65)).toBe('65+');
      expect(calculateAgeGroup(currentYear - 90)).toBe('65+');
    });
  });

  describe('isValidGender', () => {
    it('should accept valid genders', () => {
      expect(isValidGender('male')).toBe(true);
      expect(isValidGender('female')).toBe(true);
      expect(isValidGender('non_binary')).toBe(true);
      expect(isValidGender('prefer_not_to_say')).toBe(true);
    });

    it('should reject invalid genders', () => {
      expect(isValidGender('other')).toBe(false);
      expect(isValidGender('')).toBe(false);
      expect(isValidGender('Male')).toBe(false);
    });
  });

  describe('isValidCountry', () => {
    it('should accept valid ISO 3166-1 alpha-2 codes', () => {
      expect(isValidCountry('CZ')).toBe(true);
      expect(isValidCountry('US')).toBe(true);
      expect(isValidCountry('DE')).toBe(true);
    });

    it('should reject invalid codes', () => {
      expect(isValidCountry('cz')).toBe(false);
      expect(isValidCountry('USA')).toBe(false);
      expect(isValidCountry('')).toBe(false);
      expect(isValidCountry('1A')).toBe(false);
    });
  });

  describe('isValidBirthYear', () => {
    const currentYear = new Date().getFullYear();

    it('should accept valid birth years', () => {
      expect(isValidBirthYear(1990)).toBe(true);
      expect(isValidBirthYear(2000)).toBe(true);
      expect(isValidBirthYear(currentYear - 13)).toBe(true);
    });

    it('should reject too young', () => {
      expect(isValidBirthYear(currentYear - 12)).toBe(false);
      expect(isValidBirthYear(currentYear)).toBe(false);
    });

    it('should reject too old', () => {
      expect(isValidBirthYear(1899)).toBe(false);
    });

    it('should reject non-integers', () => {
      expect(isValidBirthYear(1990.5)).toBe(false);
    });
  });

  describe('K_ANONYMITY_THRESHOLD', () => {
    it('should be 5', () => {
      expect(K_ANONYMITY_THRESHOLD).toBe(5);
    });
  });

  describe('demographics endpoint', () => {
    let app: Hono;

    beforeEach(async () => {
      vi.resetAllMocks();

      const { default: scenarioRoutes } = await import('../routes/scenarios.js');
      app = new Hono();
      app.route('/api/scenarios', scenarioRoutes);
    });

    it('should return 401 without auth', async () => {
      const res = await app.request('/api/scenarios/550e8400-e29b-41d4-a716-446655440000/demographics?type=age_group');
      expect(res.status).toBe(401);
    });

    it('should return 400 for invalid type', async () => {
      (db.query.users.findFirst as any).mockResolvedValueOnce({ id: 'user-1' });

      const res = await app.request('/api/scenarios/550e8400-e29b-41d4-a716-446655440000/demographics?type=invalid', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(400);
    });

    it('should return 400 for missing type', async () => {
      const res = await app.request('/api/scenarios/550e8400-e29b-41d4-a716-446655440000/demographics', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(400);
    });

    it('should return 403 when user has not voted', async () => {
      (db.query.votes.findFirst as any).mockResolvedValueOnce(null);

      const res = await app.request('/api/scenarios/550e8400-e29b-41d4-a716-446655440000/demographics?type=age_group', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(403);
    });

    it('should return 403 for non-premium user', async () => {
      (db.query.votes.findFirst as any).mockResolvedValueOnce({ id: 'vote-1' });
      (db.query.users.findFirst as any).mockResolvedValueOnce({ id: 'user-1', isPremium: false });

      const res = await app.request('/api/scenarios/550e8400-e29b-41d4-a716-446655440000/demographics?type=age_group', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(403);
    });

    it('should filter out groups with fewer than K_ANONYMITY_THRESHOLD votes', async () => {
      // Set up mocks: vote exists, user is premium
      (db.query.votes.findFirst as any)
        .mockResolvedValueOnce({ id: 'vote-1', userId: 'user-1', scenarioId: 's-1' });
      (db.query.users.findFirst as any)
        .mockResolvedValueOnce({ id: 'user-1', isPremium: true, email: 'a@b.com', username: 'test' });

      // Mock the db.select().from().where() chain for demographic stats
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            { demographicValue: '18-24', totalVotes: 10, votesGuilty: 4, votesNotGuilty: 3, votesComplicated: 2, votesBothWrong: 1 },
            { demographicValue: '25-34', totalVotes: 3, votesGuilty: 1, votesNotGuilty: 1, votesComplicated: 1, votesBothWrong: 0 },
            { demographicValue: '35-44', totalVotes: 8, votesGuilty: 2, votesNotGuilty: 4, votesComplicated: 1, votesBothWrong: 1 },
          ]),
        }),
      });

      const res = await app.request('/api/scenarios/550e8400-e29b-41d4-a716-446655440000/demographics?type=age_group', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.type).toBe('age_group');
      expect(body.groups).toHaveLength(2);
      expect(body.groups[0].value).toBe('18-24');
      expect(body.groups[1].value).toBe('35-44');
    });

    it('should return all groups when all have >= K_ANONYMITY_THRESHOLD votes', async () => {
      (db.query.votes.findFirst as any).mockResolvedValueOnce({ id: 'vote-1' });
      (db.query.users.findFirst as any).mockResolvedValueOnce({ id: 'user-1', isPremium: true });

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            { demographicValue: 'male', totalVotes: 50, votesGuilty: 20, votesNotGuilty: 15, votesComplicated: 10, votesBothWrong: 5 },
            { demographicValue: 'female', totalVotes: 45, votesGuilty: 15, votesNotGuilty: 20, votesComplicated: 5, votesBothWrong: 5 },
          ]),
        }),
      });

      const res = await app.request('/api/scenarios/550e8400-e29b-41d4-a716-446655440000/demographics?type=gender', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.type).toBe('gender');
      expect(body.groups).toHaveLength(2);
    });
  });

  describe('user demographics update', () => {
    let app: Hono;

    beforeEach(async () => {
      vi.clearAllMocks();
      const { default: userRoutes } = await import('../routes/users.js');
      app = new Hono();
      app.route('/api/users', userRoutes);
    });

    it('should accept valid demographic data in PATCH /api/users/me', async () => {
      (db.query.users.findFirst as any).mockResolvedValueOnce({ id: 'user-1' });

      const res = await app.request('/api/users/me', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthYear: 1990, country: 'CZ', gender: 'male' }),
      });
      expect(res.status).toBe(200);
    });

    it('should reject invalid birth year', async () => {
      const res = await app.request('/api/users/me', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthYear: 2025 }),
      });
      expect(res.status).toBe(400);
    });

    it('should reject invalid country code', async () => {
      const res = await app.request('/api/users/me', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: 'USA' }),
      });
      expect(res.status).toBe(400);
    });

    it('should reject invalid gender', async () => {
      const res = await app.request('/api/users/me', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ gender: 'other' }),
      });
      expect(res.status).toBe(400);
    });

    it('should allow nullable demographic fields', async () => {
      (db.query.users.findFirst as any).mockResolvedValueOnce({ id: 'user-1' });

      const res = await app.request('/api/users/me', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthYear: null, country: null, gender: null }),
      });
      expect(res.status).toBe(200);
    });

    it('should delete demographics via DELETE /api/users/me/demographics', async () => {
      const res = await app.request('/api/users/me/demographics', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe('Demographic data deleted');
    });
  });
});
