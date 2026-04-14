import { db } from '../db/index.js';
import { appConfig } from '../db/schema.js';


// ============================================
// AI Use-Case Types
// ============================================
export type AiUseCase = 'generation' | 'moderation' | 'analysis';

// ============================================
// Allowed Models Whitelist (based on SMI-47 v3 analysis)
// ============================================
export const ALLOWED_MODELS = [
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-6-20250514',
  'claude-opus-4-6-20250414',
  'gpt-5.4-nano',
  'gpt-5.4-mini',
  'gemini-3.0-flash',
  'gemini-3.0-flash-lite',
] as const;

export type AllowedModel = typeof ALLOWED_MODELS[number];

export function isAllowedModel(model: string): model is AllowedModel {
  return (ALLOWED_MODELS as readonly string[]).includes(model);
}

// ============================================
// Default Models per Use-Case (from SMI-47 v3 analysis)
// ============================================
const DEFAULT_MODELS: Record<AiUseCase, AllowedModel> = {
  generation: 'gpt-5.4-mini',
  moderation: 'gpt-5.4-mini',
  analysis: 'claude-sonnet-4-6-20250514',
};

// Env var names per use-case
const ENV_VAR_MAP: Record<AiUseCase, string> = {
  generation: 'AI_MODEL_SCENARIO',
  moderation: 'AI_MODEL_MODERATION',
  analysis: 'AI_MODEL_EXPERT',
};

// DB config keys per use-case (provider + model)
const DB_CONFIG_KEY_MAP: Record<AiUseCase, { provider: string; model: string }> = {
  generation: { provider: 'ai.scenario.provider', model: 'ai.scenario.model' },
  moderation: { provider: 'ai.moderation.provider', model: 'ai.moderation.model' },
  analysis: { provider: 'ai.expert.provider', model: 'ai.expert.model' },
};

// ============================================
// Provider Detection
// ============================================
type Provider = 'anthropic' | 'openai' | 'google';

function detectProvider(model: string): Provider {
  if (model.startsWith('claude-')) return 'anthropic';
  if (model.startsWith('gpt-')) return 'openai';
  if (model.startsWith('gemini-')) return 'google';
  return 'anthropic'; // fallback
}

// ============================================
// Model Resolution (DB → env var → default)
// ============================================
let dbConfigCache: Map<string, string> | null = null;
let dbConfigCacheTime = 0;
const DB_CACHE_TTL = 60_000; // 1 minute

export async function loadDbConfig(): Promise<Map<string, string>> {
  const now = Date.now();
  if (dbConfigCache && now - dbConfigCacheTime < DB_CACHE_TTL) {
    return dbConfigCache;
  }

  try {
    const rows = await db.select().from(appConfig);
    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(row.key, row.value);
    }
    dbConfigCache = map;
    dbConfigCacheTime = now;
    return map;
  } catch {
    // DB not available or table doesn't exist yet — use empty map
    return new Map();
  }
}

export function invalidateConfigCache(): void {
  dbConfigCache = null;
  dbConfigCacheTime = 0;
}

export async function getModelForUseCase(useCase: AiUseCase): Promise<string> {
  // 1. Check DB config (model key)
  const config = await loadDbConfig();
  const dbModel = config.get(DB_CONFIG_KEY_MAP[useCase].model);
  if (dbModel && isAllowedModel(dbModel)) return dbModel;

  // 2. Check use-case specific env var
  const envModel = process.env[ENV_VAR_MAP[useCase]];
  if (envModel && isAllowedModel(envModel)) return envModel;

  // 3. Check generic AI_MODEL env var
  const genericModel = process.env.AI_MODEL;
  if (genericModel && isAllowedModel(genericModel)) return genericModel;

  // 4. Use default
  return DEFAULT_MODELS[useCase];
}

// ============================================
// Get Current Config (for admin endpoint)
// ============================================
export interface AiUseCaseConfig {
  model: string;
  provider: Provider;
  source: string;
}

export async function getAiConfig(): Promise<Record<AiUseCase, AiUseCaseConfig>> {
  const config = await loadDbConfig();
  const result = {} as Record<AiUseCase, AiUseCaseConfig>;

  for (const useCase of ['generation', 'moderation', 'analysis'] as AiUseCase[]) {
    const dbModel = config.get(DB_CONFIG_KEY_MAP[useCase].model);
    if (dbModel && isAllowedModel(dbModel)) {
      result[useCase] = { model: dbModel, provider: detectProvider(dbModel), source: 'database' };
      continue;
    }

    const envModel = process.env[ENV_VAR_MAP[useCase]];
    if (envModel && isAllowedModel(envModel)) {
      result[useCase] = { model: envModel, provider: detectProvider(envModel), source: 'env' };
      continue;
    }

    const genericModel = process.env.AI_MODEL;
    if (genericModel && isAllowedModel(genericModel)) {
      result[useCase] = { model: genericModel, provider: detectProvider(genericModel), source: 'env_generic' };
      continue;
    }

    const defaultModel = DEFAULT_MODELS[useCase];
    result[useCase] = { model: defaultModel, provider: detectProvider(defaultModel), source: 'default' };
  }

  return result;
}

// ============================================
// Set Model Config (writes to DB)
// ============================================
export async function setModelConfig(useCase: AiUseCase, model: string): Promise<void> {
  if (!isAllowedModel(model)) {
    throw new Error(`Model "${model}" is not in the allowed models list`);
  }

  const keys = DB_CONFIG_KEY_MAP[useCase];
  const provider = detectProvider(model);

  // Upsert model
  await db
    .insert(appConfig)
    .values({ key: keys.model, value: model })
    .onConflictDoUpdate({ target: appConfig.key, set: { value: model, updatedAt: new Date() } });

  // Upsert provider
  await db
    .insert(appConfig)
    .values({ key: keys.provider, value: provider })
    .onConflictDoUpdate({ target: appConfig.key, set: { value: provider, updatedAt: new Date() } });

  invalidateConfigCache();
}

// ============================================
// Unified AI Call
// ============================================
export interface AiCallOptions {
  useCase: AiUseCase;
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens: number;
}

export interface AiCallResult {
  text: string;
  model: string;
  provider: Provider;
}

export async function callAi(options: AiCallOptions): Promise<AiCallResult> {
  const model = await getModelForUseCase(options.useCase);
  const provider = detectProvider(model);

  switch (provider) {
    case 'anthropic':
      return callAnthropic(model, options);
    case 'openai':
      return callOpenAi(model, options);
    case 'google':
      return callGoogle(model, options);
  }
}

// ============================================
// Provider Implementations
// ============================================

async function callAnthropic(model: string, options: AiCallOptions): Promise<AiCallResult> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) throw new Error('AI_API_KEY not configured');

  const body: Record<string, unknown> = {
    model,
    max_tokens: options.maxTokens,
    messages: options.messages,
  };
  if (options.system) {
    body.system = options.system;
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);
  const data = await res.json() as any;
  if (!data.content?.[0]?.text) throw new Error('Anthropic returned unexpected response format');

  return { text: data.content[0].text, model, provider: 'anthropic' };
}

async function callOpenAi(model: string, options: AiCallOptions): Promise<AiCallResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const messages: Array<{ role: string; content: string }> = [];
  if (options.system) {
    messages.push({ role: 'system', content: options.system });
  }
  for (const msg of options.messages) {
    messages.push({ role: msg.role, content: msg.content });
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens,
      messages,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
  const data = await res.json() as any;
  if (!data.choices?.[0]?.message?.content) throw new Error('OpenAI returned unexpected response format');

  return { text: data.choices[0].message.content, model, provider: 'openai' };
}

async function callGoogle(model: string, options: AiCallOptions): Promise<AiCallResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not configured');

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  if (options.system) {
    contents.push({ role: 'user', parts: [{ text: options.system }] });
    contents.push({ role: 'model', parts: [{ text: 'Understood. I will follow these instructions.' }] });
  }

  for (const msg of options.messages) {
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: { maxOutputTokens: options.maxTokens },
      }),
    },
  );

  if (!res.ok) throw new Error(`Google AI API error: ${res.status}`);
  const data = await res.json() as any;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Google AI returned unexpected response format');

  return { text, model, provider: 'google' };
}
