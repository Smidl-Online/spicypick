import { db } from '../db/index.js';
import { votes, scenarios, moralProfiles } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { VALID_CATEGORIES, type Category } from '../constants.js';

const ROLLING_WINDOW = 100;
const MIN_VOTES = 10;

// Categories considered "emotional" vs "rational"
const EMOTIONAL_CATEGORIES: Category[] = ['relationship', 'family'];
const RATIONAL_CATEGORIES: Category[] = ['workplace', 'money'];

type VoteWithScenario = {
  verdict: string;
  scenarioId: string;
  category: string;
  totalVotes: number;
  votesGuilty: number;
  votesNotGuilty: number;
  votesComplicated: number;
  votesBothWrong: number;
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function calculateDimensions(recentVotes: VoteWithScenario[]) {
  const total = recentVotes.length;

  // forgiving = not_guilty ratio
  const notGuiltyCount = recentVotes.filter(v => v.verdict === 'not_guilty').length;
  const forgiving = clamp((notGuiltyCount / total) * 100);

  // confrontational = both_wrong ratio
  const bothWrongCount = recentVotes.filter(v => v.verdict === 'both_wrong').length;
  const confrontational = clamp((bothWrongCount / total) * 100);

  // pragmatic = complicated ratio
  const complicatedCount = recentVotes.filter(v => v.verdict === 'complicated').length;
  const pragmatic = clamp((complicatedCount / total) * 100);

  // empathetic = weighted score from emotional vs rational categories
  const emotionalVotes = recentVotes.filter(v => EMOTIONAL_CATEGORIES.includes(v.category as Category));
  const rationalVotes = recentVotes.filter(v => RATIONAL_CATEGORIES.includes(v.category as Category));
  const emotionalNotGuilty = emotionalVotes.filter(v => v.verdict === 'not_guilty').length;
  const rationalNotGuilty = rationalVotes.filter(v => v.verdict === 'not_guilty').length;
  const emotionalRate = emotionalVotes.length > 0 ? emotionalNotGuilty / emotionalVotes.length : 0.5;
  const rationalRate = rationalVotes.length > 0 ? rationalNotGuilty / rationalVotes.length : 0.5;
  // Higher empathetic score = more lenient in emotional categories relative to rational
  const empathetic = clamp(((emotionalRate - rationalRate + 1) / 2) * 100);

  // majorityAligned = ratio of votes matching majority
  let majorityMatches = 0;
  for (const v of recentVotes) {
    const counts: Record<string, number> = {
      guilty: v.votesGuilty,
      not_guilty: v.votesNotGuilty,
      complicated: v.votesComplicated,
      both_wrong: v.votesBothWrong,
    };
    const values = Object.values(counts);
    const maxCount = Math.max(...values);
    const isTie = values.filter(c => c === maxCount).length > 1;
    if (!isTie && counts[v.verdict] === maxCount) {
      majorityMatches++;
    }
  }
  const majorityAligned = clamp((majorityMatches / total) * 100);

  // consistent = 100 - normalized std deviation of verdict distribution across categories
  const categoryVerdictMap: Record<string, Record<string, number>> = {};
  for (const v of recentVotes) {
    if (!categoryVerdictMap[v.category]) {
      categoryVerdictMap[v.category] = { guilty: 0, not_guilty: 0, complicated: 0, both_wrong: 0 };
    }
    categoryVerdictMap[v.category][v.verdict]++;
  }
  const categories = Object.keys(categoryVerdictMap);
  let consistent: number;
  if (categories.length >= 2) {
    const dominantRatios = categories.map(cat => {
      const catVotes = categoryVerdictMap[cat];
      const catTotal = Object.values(catVotes).reduce((s, c) => s + c, 0);
      if (catTotal === 0) return 0;
      const maxVerdict = Math.max(...Object.values(catVotes));
      return maxVerdict / catTotal;
    });
    const mean = dominantRatios.reduce((s, r) => s + r, 0) / dominantRatios.length;
    const variance = dominantRatios.reduce((s, r) => s + (r - mean) ** 2, 0) / dominantRatios.length;
    const stdDev = Math.sqrt(variance);
    const normalizationFactor = 200;
    consistent = clamp(100 - stdDev * normalizationFactor);
  } else {
    consistent = 50;
  }

  return { forgiving, pragmatic, empathetic, confrontational, majorityAligned, consistent };
}

export async function recalculateMoralProfile(userId: string): Promise<void> {
  // Get last 100 votes with scenario data
  const recentVotes = await db
    .select({
      verdict: votes.verdict,
      scenarioId: votes.scenarioId,
      category: scenarios.category,
      totalVotes: scenarios.totalVotes,
      votesGuilty: scenarios.votesGuilty,
      votesNotGuilty: scenarios.votesNotGuilty,
      votesComplicated: scenarios.votesComplicated,
      votesBothWrong: scenarios.votesBothWrong,
    })
    .from(votes)
    .innerJoin(scenarios, eq(votes.scenarioId, scenarios.id))
    .where(eq(votes.userId, userId))
    .orderBy(desc(votes.votedAt))
    .limit(ROLLING_WINDOW);

  if (recentVotes.length < MIN_VOTES) {
    return; // Not enough votes to calculate
  }

  const dimensions = calculateDimensions(recentVotes);
  const now = new Date();

  // Upsert moral profile (atomic to avoid race conditions)
  await db.insert(moralProfiles).values({
    userId,
    ...dimensions,
    totalVotesAnalyzed: recentVotes.length,
    lastCalculatedAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: moralProfiles.userId,
    set: {
      ...dimensions,
      totalVotesAnalyzed: recentVotes.length,
      lastCalculatedAt: now,
      updatedAt: now,
    },
  });
}

export { MIN_VOTES, ROLLING_WINDOW, calculateDimensions };
export type { VoteWithScenario };
