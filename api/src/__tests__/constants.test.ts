import { describe, it, expect } from 'vitest';
import { VALID_CATEGORIES } from '../constants.js';

describe('constants', () => {
  it('should export valid categories', () => {
    expect(VALID_CATEGORIES).toBeDefined();
    expect(VALID_CATEGORIES.length).toBeGreaterThan(0);
  });

  it('should include expected categories', () => {
    expect(VALID_CATEGORIES).toContain('workplace');
    expect(VALID_CATEGORIES).toContain('relationship');
    expect(VALID_CATEGORIES).toContain('family');
    expect(VALID_CATEGORIES).toContain('friends');
    expect(VALID_CATEGORIES).toContain('money');
    expect(VALID_CATEGORIES).toContain('neighbors');
  });

  it('should have unique values', () => {
    const unique = new Set(VALID_CATEGORIES);
    expect(unique.size).toBe(VALID_CATEGORIES.length);
  });
});
