import { db } from '../db/index.js';
import { scenarios } from '../db/schema.js';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { callAi } from '../services/aiClient.js';

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
  // Fallback: if no AI provider key is configured, return a community-based summary
  if (!process.env.AI_API_KEY && !process.env.OPENAI_API_KEY && !process.env.GOOGLE_AI_API_KEY) {
    return buildCommunityFallback(scenario);
  }

  const result = await callAi({
    useCase: 'analysis',
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
    maxTokens: 300,
  });

  return result.text;
}

function buildCommunityFallback(scenario: {
  votesGuilty: number;
  votesNotGuilty: number;
  votesComplicated: number;
  votesBothWrong: number;
  totalVotes: number;
}): string {
  const votes = [
    { label: 'Guilty', count: scenario.votesGuilty },
    { label: 'Not Guilty', count: scenario.votesNotGuilty },
    { label: "It's Complicated", count: scenario.votesComplicated },
    { label: 'Both Wrong', count: scenario.votesBothWrong },
  ];
  votes.sort((a, b) => b.count - a.count);
  const top = votes[0];
  const pct = Math.round((top.count / scenario.totalVotes) * 100);
  return `The community verdict is "${top.label}" with ${pct}% of ${scenario.totalVotes} votes.`;
}
