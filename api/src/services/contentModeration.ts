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
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    // No API key — skip moderation, mark as pending for manual review
    return { approved: false, reason: 'AI moderation unavailable — queued for manual review', category: null, flags: [] };
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: MODERATION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Review this scenario submission:\n\n<user_content>\n${text}\n</user_content>` }],
      }),
    });

    if (!res.ok) {
      console.error(`[MODERATION] AI API error: ${res.status}`);
      return { approved: false, reason: 'AI moderation failed — queued for manual review', category: null, flags: [] };
    }

    const data = await res.json() as any;
    if (!data.content?.[0]?.text) {
      return { approved: false, reason: 'AI returned unexpected format — queued for manual review', category: null, flags: [] };
    }

    let responseText: string = data.content[0].text;
    // Strip markdown code fences
    const fenceMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) responseText = fenceMatch[1].trim();

    const result = JSON.parse(responseText) as ModerationResult;
    return {
      approved: !!result.approved,
      reason: result.reason || '',
      category: result.category || null,
      flags: Array.isArray(result.flags) ? result.flags : [],
    };
  } catch (err) {
    console.error('[MODERATION] Error:', err);
    return { approved: false, reason: 'Moderation error — queued for manual review', category: null, flags: [] };
  }
}
