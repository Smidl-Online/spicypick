import { describe, it, expect } from 'vitest';
import { calculateLevel, calculateVoteXp, xpForLevel, LEAGUE_TIERS } from '../services/gamification.js';

describe('gamification', () => {
  describe('xpForLevel', () => {
    it('should return increasing XP thresholds', () => {
      let prev = 0;
      for (let level = 2; level <= 50; level++) {
        const xp = xpForLevel(level);
        expect(xp).toBeGreaterThan(prev);
        prev = xp;
      }
    });

    it('should return integer values', () => {
      for (let level = 1; level <= 100; level++) {
        expect(Number.isInteger(xpForLevel(level))).toBe(true);
      }
    });
  });

  describe('calculateLevel', () => {
    it('should return level 1 for 0 XP', () => {
      expect(calculateLevel(0)).toBe(1);
    });

    it('should return level 1 for XP below level 2 threshold', () => {
      const level2Xp = xpForLevel(2);
      expect(calculateLevel(level2Xp - 1)).toBe(1);
    });

    it('should return level 2 when XP reaches level 2 threshold', () => {
      const level2Xp = xpForLevel(2);
      expect(calculateLevel(level2Xp)).toBe(2);
    });

    it('should handle high XP values', () => {
      const level = calculateLevel(100000);
      expect(level).toBeGreaterThan(10);
    });

    it('should be monotonically increasing', () => {
      let prevLevel = 1;
      for (let xp = 0; xp <= 5000; xp += 50) {
        const level = calculateLevel(xp);
        expect(level).toBeGreaterThanOrEqual(prevLevel);
        prevLevel = level;
      }
    });
  });

  describe('calculateVoteXp', () => {
    it('should return base 10 XP for no streak and no majority', () => {
      expect(calculateVoteXp(0, false)).toBe(10);
    });

    it('should add 5 XP for majority match', () => {
      expect(calculateVoteXp(0, true)).toBe(15);
    });

    it('should add streak bonus (2 per streak day)', () => {
      expect(calculateVoteXp(5, false)).toBe(10 + 10); // 10 base + 5*2 streak
    });

    it('should cap streak bonus at 60', () => {
      expect(calculateVoteXp(100, false)).toBe(10 + 60); // capped at 60
      expect(calculateVoteXp(30, false)).toBe(10 + 60); // exactly cap
      expect(calculateVoteXp(31, false)).toBe(10 + 60); // still capped
    });

    it('should combine streak bonus and majority match', () => {
      expect(calculateVoteXp(5, true)).toBe(10 + 5 + 10); // 25
    });
  });

  describe('LEAGUE_TIERS', () => {
    it('should have 10 tiers', () => {
      expect(LEAGUE_TIERS).toHaveLength(10);
    });

    it('should start with bronze and end with amethyst', () => {
      expect(LEAGUE_TIERS[0]).toBe('bronze');
      expect(LEAGUE_TIERS[LEAGUE_TIERS.length - 1]).toBe('amethyst');
    });

    it('should have unique values', () => {
      const unique = new Set(LEAGUE_TIERS);
      expect(unique.size).toBe(LEAGUE_TIERS.length);
    });
  });
});
