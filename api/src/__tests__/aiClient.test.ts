import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock DB
const mockSelect = vi.fn();
const mockInsert = vi.fn();

vi.mock('../db/index.js', () => ({
  db: {
    select: () => ({ from: mockSelect }),
    insert: () => ({
      values: (v: any) => ({
        onConflictDoUpdate: mockInsert,
      }),
    }),
  },
}));

vi.mock('../db/schema.js', () => ({
  appConfig: { key: 'key' },
}));

// Mock fetch globally — must be before module import
const mockFetch = vi.fn();
globalThis.fetch = mockFetch as any;

describe('aiClient', () => {
  let aiClient: typeof import('../services/aiClient.js');
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Re-apply mock fetch (resetModules may reload)
    globalThis.fetch = mockFetch as any;

    // Default: DB returns empty config
    mockSelect.mockResolvedValue([]);

    // Default env
    process.env.AI_API_KEY = 'test-anthropic-key';
    delete process.env.AI_MODEL;
    delete process.env.AI_MODEL_GENERATION;
    delete process.env.AI_MODEL_MODERATION;
    delete process.env.AI_MODEL_ANALYSIS;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GOOGLE_AI_API_KEY;

    aiClient = await import('../services/aiClient.js');
    aiClient.invalidateConfigCache();
  });

  describe('isAllowedModel', () => {
    it('should accept allowed models', () => {
      expect(aiClient.isAllowedModel('claude-haiku-4-5-20241022')).toBe(true);
      expect(aiClient.isAllowedModel('claude-sonnet-4-20250514')).toBe(true);
      expect(aiClient.isAllowedModel('gpt-4o-mini')).toBe(true);
      expect(aiClient.isAllowedModel('gemini-2.5-flash')).toBe(true);
    });

    it('should reject unknown models', () => {
      expect(aiClient.isAllowedModel('gpt-3.5-turbo')).toBe(false);
      expect(aiClient.isAllowedModel('random-model')).toBe(false);
      expect(aiClient.isAllowedModel('')).toBe(false);
    });
  });

  describe('getModelForUseCase — fallback chain', () => {
    it('should return default model when nothing is configured', async () => {
      const model = await aiClient.getModelForUseCase('generation');
      expect(model).toBe('claude-haiku-4-5-20241022');
    });

    it('should return default analysis model (Sonnet)', async () => {
      const model = await aiClient.getModelForUseCase('analysis');
      expect(model).toBe('claude-sonnet-4-20250514');
    });

    it('should use generic AI_MODEL env var as fallback', async () => {
      process.env.AI_MODEL = 'claude-opus-4-20250514';
      aiClient.invalidateConfigCache();
      const model = await aiClient.getModelForUseCase('generation');
      expect(model).toBe('claude-opus-4-20250514');
    });

    it('should prefer use-case specific env var over generic', async () => {
      process.env.AI_MODEL = 'claude-opus-4-20250514';
      process.env.AI_MODEL_GENERATION = 'gpt-4o-mini';
      aiClient.invalidateConfigCache();
      const model = await aiClient.getModelForUseCase('generation');
      expect(model).toBe('gpt-4o-mini');
    });

    it('should prefer DB config over env vars', async () => {
      process.env.AI_MODEL_GENERATION = 'gpt-4o-mini';
      mockSelect.mockResolvedValue([
        { key: 'ai_model_generation', value: 'claude-sonnet-4-20250514' },
      ]);
      aiClient.invalidateConfigCache();
      const model = await aiClient.getModelForUseCase('generation');
      expect(model).toBe('claude-sonnet-4-20250514');
    });

    it('should ignore invalid model in DB and fall through to env', async () => {
      process.env.AI_MODEL_MODERATION = 'claude-haiku-4-5-20241022';
      mockSelect.mockResolvedValue([
        { key: 'ai_model_moderation', value: 'invalid-model-name' },
      ]);
      aiClient.invalidateConfigCache();
      const model = await aiClient.getModelForUseCase('moderation');
      expect(model).toBe('claude-haiku-4-5-20241022');
    });

    it('should ignore invalid model in env and use default', async () => {
      process.env.AI_MODEL = 'not-a-real-model';
      aiClient.invalidateConfigCache();
      const model = await aiClient.getModelForUseCase('generation');
      expect(model).toBe('claude-haiku-4-5-20241022');
    });
  });

  describe('getAiConfig', () => {
    it('should return all use-case configs with sources', async () => {
      const config = await aiClient.getAiConfig();
      expect(config.generation).toEqual({ model: 'claude-haiku-4-5-20241022', source: 'default' });
      expect(config.moderation).toEqual({ model: 'claude-haiku-4-5-20241022', source: 'default' });
      expect(config.analysis).toEqual({ model: 'claude-sonnet-4-20250514', source: 'default' });
    });

    it('should report DB source when model is set in DB', async () => {
      mockSelect.mockResolvedValue([
        { key: 'ai_model_generation', value: 'gpt-4o-mini' },
      ]);
      aiClient.invalidateConfigCache();
      const config = await aiClient.getAiConfig();
      expect(config.generation).toEqual({ model: 'gpt-4o-mini', source: 'database' });
    });

    it('should report env source when set via env var', async () => {
      process.env.AI_MODEL_ANALYSIS = 'claude-opus-4-20250514';
      aiClient.invalidateConfigCache();
      const config = await aiClient.getAiConfig();
      expect(config.analysis).toEqual({ model: 'claude-opus-4-20250514', source: 'env' });
    });
  });

  describe('callAi — Anthropic provider', () => {
    it('should call Anthropic API with correct params', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ content: [{ text: 'Hello world' }] }),
      });

      const result = await aiClient.callAi({
        useCase: 'generation',
        system: 'You are a test assistant',
        messages: [{ role: 'user', content: 'Say hello' }],
        maxTokens: 100,
      });

      expect(result.text).toBe('Hello world');
      expect(result.provider).toBe('anthropic');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'test-anthropic-key',
          }),
        }),
      );
    });

    it('should throw when AI_API_KEY is not set', async () => {
      delete process.env.AI_API_KEY;
      await expect(aiClient.callAi({
        useCase: 'generation',
        messages: [{ role: 'user', content: 'test' }],
        maxTokens: 100,
      })).rejects.toThrow('AI_API_KEY not configured');
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });
      await expect(aiClient.callAi({
        useCase: 'generation',
        messages: [{ role: 'user', content: 'test' }],
        maxTokens: 100,
      })).rejects.toThrow('Anthropic API error: 500');
    });
  });

  describe('callAi — OpenAI provider', () => {
    it('should call OpenAI API when model is gpt-*', async () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';
      mockSelect.mockResolvedValue([
        { key: 'ai_model_generation', value: 'gpt-4o-mini' },
      ]);
      aiClient.invalidateConfigCache();

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ choices: [{ message: { content: 'OpenAI response' } }] }),
      });

      const result = await aiClient.callAi({
        useCase: 'generation',
        system: 'Test system',
        messages: [{ role: 'user', content: 'test' }],
        maxTokens: 100,
      });

      expect(result.text).toBe('OpenAI response');
      expect(result.provider).toBe('openai');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.anything(),
      );
    });
  });

  describe('callAi — Google provider', () => {
    it('should call Google AI API when model is gemini-*', async () => {
      process.env.GOOGLE_AI_API_KEY = 'test-google-key';
      mockSelect.mockResolvedValue([
        { key: 'ai_model_generation', value: 'gemini-2.5-flash' },
      ]);
      aiClient.invalidateConfigCache();

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: 'Gemini response' }] } }] }),
      });

      const result = await aiClient.callAi({
        useCase: 'generation',
        messages: [{ role: 'user', content: 'test' }],
        maxTokens: 100,
      });

      expect(result.text).toBe('Gemini response');
      expect(result.provider).toBe('google');
    });
  });

  describe('config cache', () => {
    it('should cache DB config and reuse it', async () => {
      mockSelect.mockResolvedValue([]);
      aiClient.invalidateConfigCache();

      await aiClient.getModelForUseCase('generation');
      await aiClient.getModelForUseCase('moderation');

      // DB should be called only once due to caching
      expect(mockSelect).toHaveBeenCalledTimes(1);
    });

    it('should refresh cache after invalidation', async () => {
      mockSelect.mockResolvedValue([]);
      aiClient.invalidateConfigCache();

      await aiClient.getModelForUseCase('generation');
      aiClient.invalidateConfigCache();
      await aiClient.getModelForUseCase('generation');

      expect(mockSelect).toHaveBeenCalledTimes(2);
    });
  });
});
