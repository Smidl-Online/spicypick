import { z } from 'zod';
import { db } from '../db/index.js';
import { scenarios } from '../db/schema.js';

const CATEGORIES = ['workplace', 'relationship', 'family', 'neighbors', 'friends', 'money'];

const aiResponseSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
});

const SYSTEM_PROMPT = `You are a scenario writer for SpicyPick, a social judgment game.
Write a realistic, morally ambiguous scenario from first person perspective.
Max 150 words. Must be debatable - no clear right/wrong answer.
No politics, religion, racism, sexism.
Return JSON: {"title": "...", "body": "..."}`;

export async function generateScenario(category?: string) {
  const cat = category || CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) throw new Error('AI_API_KEY not configured');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Generate a ${cat} scenario.` }],
    }),
  });

  if (!res.ok) throw new Error(`AI API error: ${res.status}`);
  const data = await res.json() as any;
  const text = data.content[0].text;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(`AI returned invalid JSON: ${text.substring(0, 200)}`);
  }
  const parsed = aiResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`AI response missing required fields: ${parsed.error.message}`);
  }
  return { title: parsed.data.title, body: parsed.data.body, category: cat };
}

export async function generateAndSaveScenario(category?: string) {
  const scenario = await generateScenario(category);
  const [saved] = await db.insert(scenarios).values({
    title: scenario.title,
    body: scenario.body,
    category: scenario.category,
    source: 'ai_generated',
    status: 'draft',
  }).returning();
  return saved;
}
