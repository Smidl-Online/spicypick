import { db } from '../db/index.js';
import { scenarios } from '../db/schema.js';
import { eq, and, isNull, lte, gt } from 'drizzle-orm';

export async function generateExpertAnalysis() {
  // Find published scenarios without expert analysis that have votes
  const needsAnalysis = await db.query.scenarios.findMany({
    where: and(
      eq(scenarios.status, 'published'),
      isNull(scenarios.expertAnalysis),
      gt(scenarios.totalVotes, 0),
    ),
  });

  console.log(`[CRON] Found ${needsAnalysis.length} scenarios needing expert analysis`);

  for (const scenario of needsAnalysis) {
    try {
      const analysis = await generateAnalysis(scenario);
      await db.update(scenarios).set({ expertAnalysis: analysis }).where(eq(scenarios.id, scenario.id));
      console.log(`[CRON] Generated analysis for "${scenario.title}"`);
    } catch (err) {
      console.error(`[CRON] Failed to generate analysis for "${scenario.title}":`, err);
    }
  }
}

async function generateAnalysis(scenario: {
  title: string;
  body: string;
  votesGuilty: number;
  votesNotGuilty: number;
  votesComplicated: number;
  votesBothWrong: number;
  totalVotes: number;
}): Promise<string> {
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    // Fallback when no AI key configured
    const majorityVerdict = getMajorityVerdict(scenario);
    return `Community verdict: ${majorityVerdict}. ${scenario.totalVotes} people weighed in on this scenario. The split in opinions suggests this is a genuinely complex situation with valid perspectives on multiple sides.`;
  }

  // Use Claude API for analysis
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `Analyze this social scenario from a psychological/social perspective. Be balanced, empathetic, and insightful. 2-3 sentences max.

Scenario: ${scenario.body}

Community vote results (${scenario.totalVotes} votes):
- Guilty: ${scenario.votesGuilty} (${Math.round((scenario.votesGuilty / scenario.totalVotes) * 100)}%)
- Not Guilty: ${scenario.votesNotGuilty} (${Math.round((scenario.votesNotGuilty / scenario.totalVotes) * 100)}%)
- It's Complicated: ${scenario.votesComplicated} (${Math.round((scenario.votesComplicated / scenario.totalVotes) * 100)}%)
- Both Wrong: ${scenario.votesBothWrong} (${Math.round((scenario.votesBothWrong / scenario.totalVotes) * 100)}%)

Provide a brief expert analysis (2-3 sentences):`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json() as { content: Array<{ text: string }> };
  return data.content[0].text;
}

function getMajorityVerdict(scenario: {
  votesGuilty: number;
  votesNotGuilty: number;
  votesComplicated: number;
  votesBothWrong: number;
}): string {
  const map = [
    { label: 'Guilty', count: scenario.votesGuilty },
    { label: 'Not Guilty', count: scenario.votesNotGuilty },
    { label: "It's Complicated", count: scenario.votesComplicated },
    { label: 'Both Wrong', count: scenario.votesBothWrong },
  ];
  map.sort((a, b) => b.count - a.count);
  return map[0].label;
}
