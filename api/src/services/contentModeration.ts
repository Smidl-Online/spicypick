import { callAi } from './aiClient.js';

const MODERATION_SYSTEM_PROMPT = `You are a content moderator for SpicyPick, a social judgment game where users submit morally ambiguous scenarios.

Review the submitted scenario and respond with JSON:
{
  "approved": true/false,
  "reason": "brief explanation",
  "category": "suggested category or null",
  "flags": ["list of content flags if any"]
}

APPROVE scenarios that are:
- Morally ambiguous with no clear right/wrong answer
- Realistic everyday situations (workplace, relationships, family, friends, money, neighbors)
- Written in first person
- Debatable and thought-provoking

REJECT scenarios that contain:
- Hate speech, racism, sexism, homophobia
- Explicit sexual content or graphic violence
- Political propaganda or religious proselytizing
- Promotion of illegal activities (drugs, fraud, etc.)
- Personal attacks or doxxing
- Spam, gibberish, or off-topic content
- Content involving minors in inappropriate situations
- Self-harm or suicide references

Categories: workplace, relationship, family, friends, money, neighbors`;

export interface ModerationResult {
  approved: boolean;
  reason: string;
  category: string | null;
  flags: string[];
}

export async function moderateContent(text: string): Promise<ModerationResult> {
  try {
    const result = await callAi({
      useCase: 'moderation',
      system: MODERATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Review this scenario submission:\n\n<user_content>\n${text}\n</user_content>` }],
      maxTokens: 300,
    });

    let responseText = result.text;
    // Strip markdown code fences
    const fenceMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) responseText = fenceMatch[1].trim();

    const parsed = JSON.parse(responseText) as ModerationResult;
    return {
      approved: !!parsed.approved,
      reason: parsed.reason || '',
      category: parsed.category || null,
      flags: Array.isArray(parsed.flags) ? parsed.flags : [],
    };
  } catch (err) {
    console.error('[MODERATION] Error:', err);
    return { approved: false, reason: 'Moderation error — queued for manual review', category: null, flags: [] };
  }
}
