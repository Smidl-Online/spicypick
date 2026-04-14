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

// Mock aiClient with updated model IDs (SMI-47 v3)
const mockGetAiConfig = vi.fn();
const mockSetModelConfig = vi.fn();

vi.mock('../services/aiClient.js', () => ({
  getAiConfig: (...args: any[]) => mockGetAiConfig(...args),
  setModelConfig: (...args: any[]) => mockSetModelConfig(...args),
  isAllowedModel: (model: string) => [
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-6-20250514',
    'claude-opus-4-6-20250414',
    'gpt-5.4-nano',
    'gpt-5.4-mini',
    'gemini-3.0-flash',
    'gemini-3.0-flash-lite',
  ].includes(model),
  hasKeyForModel: () => true,
  ALLOWED_MODELS: [
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-6-20250514',
    'claude-opus-4-6-20250414',
    'gpt-5.4-nano',
    'gpt-5.4-mini',
    'gemini-3.0-flash',
    'gemini-3.0-flash-lite',
  ],
}));

process.env.ADMIN_TOKEN = 'test-admin-token';

describe('admin AI config routes', () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockGetAiConfig.mockResolvedValue({
      generation: { model: 'claude-haiku-4-5-20251001', provider: 'anthropic', source: 'default' },
      moderation: { model: 'claude-haiku-4-5-20251001', provider: 'anthropic', source: 'default' },
      analysis: { model: 'claude-sonnet-4-6-20250514', provider: 'anthropic', source: 'default' },
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
      expect(html).toContain('gpt-5.4-mini');
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
      expect(data.config.generation.model).toBe('claude-haiku-4-5-20251001');
      expect(data.config.generation.provider).toBe('anthropic');
      expect(data.config.analysis.model).toBe('claude-sonnet-4-6-20250514');
      expect(data.config.analysis.provider).toBe('anthropic');
      expect(data.allowedModels).toContain('gpt-5.4-mini');
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
        body: JSON.stringify({ generation: 'gpt-5.4-nano' }),
      });
      expect(res.status).toBe(200);
      expect(mockSetModelConfig).toHaveBeenCalledWith('generation', 'gpt-5.4-nano');
      const data = await res.json();
      expect(data.updated.generation).toBe('gpt-5.4-nano');
    });

    it('should update multiple use-cases at once', async () => {
      const res = await app.request('/admin/ai/config', {
        method: 'PATCH',
        headers: {
          ADMIN_TOKEN: 'test-admin-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          generation: 'gemini-3.0-flash',
          analysis: 'claude-opus-4-6-20250414',
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
        body: JSON.stringify({ generation: 'gpt-5.4-mini' }),
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
        body: 'useCase=generation&model=gpt-5.4-nano',
      });
      // Should redirect back to config page
      expect(res.status).toBe(302);
      expect(mockSetModelConfig).toHaveBeenCalledWith('generation', 'gpt-5.4-nano');
    });

    it('should reject invalid use-case', async () => {
      const res = await app.request('/admin/ai/config', {
        method: 'POST',
        headers: {
          ADMIN_TOKEN: 'test-admin-token',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'useCase=invalid&model=gpt-5.4-mini',
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
