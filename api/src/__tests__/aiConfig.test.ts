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
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => [{ id: 'new-id' }]),
        onConflictDoUpdate: vi.fn(),
      })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    transaction: vi.fn(async (fn: Function) => fn({
      query: {
        scenarioSubmissions: {
          findFirst: vi.fn(() => Promise.resolve({ id: 'sub-1', status: 'approved' })),
        },
      },
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

// Mock aiClient
const mockGetAiConfig = vi.fn();
const mockSetModelConfig = vi.fn();

vi.mock('../services/aiClient.js', () => ({
  getAiConfig: (...args: any[]) => mockGetAiConfig(...args),
  setModelConfig: (...args: any[]) => mockSetModelConfig(...args),
  isAllowedModel: (model: string) => [
    'claude-haiku-4-5-20241022',
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250514',
    'gpt-4o-mini',
    'gpt-4o',
    'gemini-2.5-flash',
  ].includes(model),
  ALLOWED_MODELS: [
    'claude-haiku-4-5-20241022',
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250514',
    'gpt-4o-mini',
    'gpt-4o',
    'gemini-2.5-flash',
  ],
}));

process.env.ADMIN_TOKEN = 'test-admin-token';

describe('admin AI config routes', () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockGetAiConfig.mockResolvedValue({
      generation: { model: 'claude-haiku-4-5-20241022', source: 'default' },
      moderation: { model: 'claude-haiku-4-5-20241022', source: 'default' },
      analysis: { model: 'claude-sonnet-4-20250514', source: 'default' },
    });

    const { default: adminRoutes } = await import('../routes/admin.js');
    app = new Hono();
    app.route('/admin', adminRoutes);
  });

  describe('GET /admin/ai/config', () => {
    it('should return HTML config page when authenticated', async () => {
      const res = await app.request('/admin/ai/config', {
        headers: { ADMIN_TOKEN: 'test-admin-token' },
      });
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('AI Model Configuration');
      expect(html).toContain('Scenario Generation');
      expect(html).toContain('Content Moderation');
      expect(html).toContain('Expert Analysis');
      expect(html).toContain('claude-haiku-4-5-20241022');
    });

    it('should return JSON when Accept: application/json', async () => {
      const res = await app.request('/admin/ai/config', {
        headers: {
          ADMIN_TOKEN: 'test-admin-token',
          Accept: 'application/json',
        },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.config.generation.model).toBe('claude-haiku-4-5-20241022');
      expect(data.config.analysis.model).toBe('claude-sonnet-4-20250514');
      expect(data.allowedModels).toContain('gpt-4o-mini');
    });

    it('should require authentication', async () => {
      const res = await app.request('/admin/ai/config');
      const html = await res.text();
      expect(html).toContain('Admin Login');
    });
  });

  describe('PATCH /admin/ai/config (JSON API)', () => {
    it('should update a single use-case model', async () => {
      const res = await app.request('/admin/ai/config', {
        method: 'PATCH',
        headers: {
          ADMIN_TOKEN: 'test-admin-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ generation: 'gpt-4o-mini' }),
      });
      expect(res.status).toBe(200);
      expect(mockSetModelConfig).toHaveBeenCalledWith('generation', 'gpt-4o-mini');
      const data = await res.json();
      expect(data.updated.generation).toBe('gpt-4o-mini');
    });

    it('should update multiple use-cases at once', async () => {
      const res = await app.request('/admin/ai/config', {
        method: 'PATCH',
        headers: {
          ADMIN_TOKEN: 'test-admin-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          generation: 'gpt-4o-mini',
          analysis: 'claude-opus-4-20250514',
        }),
      });
      expect(res.status).toBe(200);
      expect(mockSetModelConfig).toHaveBeenCalledTimes(2);
    });

    it('should reject invalid models', async () => {
      const res = await app.request('/admin/ai/config', {
        method: 'PATCH',
        headers: {
          ADMIN_TOKEN: 'test-admin-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ generation: 'invalid-model' }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Invalid model');
    });

    it('should require authentication', async () => {
      const res = await app.request('/admin/ai/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generation: 'gpt-4o-mini' }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe('POST /admin/ai/config (HTML form)', () => {
    it('should update model via form submission', async () => {
      const res = await app.request('/admin/ai/config', {
        method: 'POST',
        headers: {
          ADMIN_TOKEN: 'test-admin-token',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'useCase=generation&model=gpt-4o-mini',
      });
      // Should redirect back to config page
      expect(res.status).toBe(302);
      expect(mockSetModelConfig).toHaveBeenCalledWith('generation', 'gpt-4o-mini');
    });

    it('should reject invalid use-case', async () => {
      const res = await app.request('/admin/ai/config', {
        method: 'POST',
        headers: {
          ADMIN_TOKEN: 'test-admin-token',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'useCase=invalid&model=gpt-4o-mini',
      });
      expect(res.status).toBe(400);
    });

    it('should reject invalid model', async () => {
      const res = await app.request('/admin/ai/config', {
        method: 'POST',
        headers: {
          ADMIN_TOKEN: 'test-admin-token',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'useCase=generation&model=bad-model',
      });
      expect(res.status).toBe(400);
    });
  });
});
