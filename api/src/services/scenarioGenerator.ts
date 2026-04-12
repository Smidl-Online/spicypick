import { db } from '../db/index.js';
import { scenarios } from '../db/schema.js';
import { VALID_CATEGORIES } from '../constants.js';

const LOCALE_PROMPTS: Record<string, string> = {
  en: 'Write the scenario in English.',
  cs: 'Write the scenario in Czech (čeština).',
  de: 'Write the scenario in German (Deutsch).',
  es: 'Write the scenario in Spanish (español).',
  fr: 'Write the scenario in French (français).',
  pt: 'Write the scenario in Portuguese (português).',
  ja: 'Write the scenario in Japanese (日本語).',
};

const SYSTEM_PROMPT = `You are a scenario writer for SpicyPick, a social judgment game.
Write a realistic, morally ambiguous scenario from first person perspective.
Max 150 words. Must be debatable - no clear right/wrong answer.
No politics, religion, racism, sexism.
Return JSON: {"title": "...", "body": "..."}`;

export async function generateScenario(category?: string, locale?: string) {
  const cat = category || VALID_CATEGORIES[Math.floor(Math.random() * VALID_CATEGORIES.length)];
  const lang = locale || 'en';
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) throw new Error('AI_API_KEY not configured');

  const langInstruction = LOCALE_PROMPTS[lang] || LOCALE_PROMPTS.en;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Generate a ${cat} scenario. ${langInstruction}` }],
    }),
  });

  if (!res.ok) throw new Error(`AI API error: ${res.status}`);
  const data = await res.json() as any;
  if (!data.content?.[0]?.text) throw new Error('AI returned unexpected response format');
  let text: string = data.content[0].text;
  // Strip markdown code fences if AI wraps response in ```json ... ```
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();
  let parsed: { title: string; body: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`AI returned invalid JSON: ${text.substring(0, 200)}`);
  }
  if (!parsed.title || !parsed.body) {
    throw new Error('AI response missing required fields (title, body)');
  }
  return { title: parsed.title, body: parsed.body, category: cat, locale: lang };
}

export async function generateAndSaveScenario(category?: string, locale?: string) {
  const scenario = await generateScenario(category, locale);
  const [saved] = await db.insert(scenarios).values({
    title: scenario.title,
    body: scenario.body,
    category: scenario.category,
    locale: scenario.locale,
    source: 'ai_generated',
    status: 'draft',
  }).returning();
  return saved;
}
