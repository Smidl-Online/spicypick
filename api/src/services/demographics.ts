import { db } from '../db/index.js';
import { demographicStats, users, votes } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';

const AGE_GROUPS = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'] as const;
export type AgeGroup = typeof AGE_GROUPS[number];

const VALID_GENDERS = ['male', 'female', 'non_binary', 'prefer_not_to_say'] as const;
export type Gender = typeof VALID_GENDERS[number];

// k-anonymity threshold
export const K_ANONYMITY_THRESHOLD = 5;

export function calculateAgeGroup(birthYear: number): AgeGroup | null {
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;
  if (age < 13) return null;
  if (age <= 17) return '13-17';
  if (age <= 24) return '18-24';
  if (age <= 34) return '25-34';
  if (age <= 44) return '35-44';
  if (age <= 54) return '45-54';
  if (age <= 64) return '55-64';
  return '65+';
}

export function isValidGender(gender: string): gender is Gender {
  return (VALID_GENDERS as readonly string[]).includes(gender);
}

const ISO_3166_ALPHA2 = new Set([
  'AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ',
  'BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BV','BW','BY','BZ',
  'CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CU','CV','CW','CX','CY','CZ',
  'DE','DJ','DK','DM','DO','DZ','EC','EE','EG','EH','ER','ES','ET',
  'FI','FJ','FK','FM','FO','FR','GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY',
  'HK','HM','HN','HR','HT','HU','ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT',
  'JE','JM','JO','JP','KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ',
  'LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY',
  'MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ',
  'NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ',
  'OM','PA','PE','PF','PG','PH','PK','PL','PM','PN','PR','PS','PT','PW','PY','QA',
  'RE','RO','RS','RU','RW','SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ',
  'TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ',
  'UA','UG','UM','US','UY','UZ','VA','VC','VE','VG','VI','VN','VU',
  'WF','WS','XK','YE','YT','ZA','ZM','ZW',
]);

export function isValidCountry(code: string): boolean {
  return ISO_3166_ALPHA2.has(code);
}

export function isValidBirthYear(year: number): boolean {
  const currentYear = new Date().getFullYear();
  return Number.isInteger(year) && year >= 1900 && year <= currentYear - 13;
}

const VALID_VERDICTS = ['guilty', 'not_guilty', 'complicated', 'both_wrong'] as const;

/** Build demographic groups from user fields. */
function buildDemographicGroups(user: { birthYear: number | null; country: string | null; gender: string | null }): { type: string; value: string }[] {
  const groups: { type: string; value: string }[] = [];
  if (user.birthYear) {
    const ageGroup = calculateAgeGroup(user.birthYear);
    if (ageGroup) groups.push({ type: 'age_group', value: ageGroup });
  }
  if (user.country) groups.push({ type: 'country', value: user.country });
  if (user.gender) groups.push({ type: 'gender', value: user.gender });
  return groups;
}

/** Verdict string to column increment/decrement mapping. */
function verdictColumnSet(verdict: string, delta: 1 | -1) {
  return {
    totalVotes: sql`GREATEST(${demographicStats.totalVotes} + ${delta}, 0)`,
    ...(verdict === 'guilty' && { votesGuilty: sql`GREATEST(${demographicStats.votesGuilty} + ${delta}, 0)` }),
    ...(verdict === 'not_guilty' && { votesNotGuilty: sql`GREATEST(${demographicStats.votesNotGuilty} + ${delta}, 0)` }),
    ...(verdict === 'complicated' && { votesComplicated: sql`GREATEST(${demographicStats.votesComplicated} + ${delta}, 0)` }),
    ...(verdict === 'both_wrong' && { votesBothWrong: sql`GREATEST(${demographicStats.votesBothWrong} + ${delta}, 0)` }),
  };
}

/**
 * Update demographic_stats for a vote. Called after a successful vote insert.
 * Uses upsert (INSERT ON CONFLICT UPDATE) for atomicity.
 */
export async function updateDemographicStats(
  scenarioId: string,
  userId: string,
  verdict: string,
): Promise<void> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return;

  if (!(VALID_VERDICTS as readonly string[]).includes(verdict)) return;

  const groups = buildDemographicGroups(user);

  for (const group of groups) {
    await db.insert(demographicStats).values({
      scenarioId,
      demographicType: group.type,
      demographicValue: group.value,
      totalVotes: 1,
      votesGuilty: verdict === 'guilty' ? 1 : 0,
      votesNotGuilty: verdict === 'not_guilty' ? 1 : 0,
      votesComplicated: verdict === 'complicated' ? 1 : 0,
      votesBothWrong: verdict === 'both_wrong' ? 1 : 0,
    }).onConflictDoUpdate({
      target: [demographicStats.scenarioId, demographicStats.demographicType, demographicStats.demographicValue],
      set: verdictColumnSet(verdict, 1),
    });
  }
}

/**
 * Decrement demographic_stats for a user's votes when demographics change or are deleted.
 * Uses GREATEST(..., 0) to prevent negative counts.
 */
async function adjustDemographicStatsForUserVotes(
  userDemographics: { birthYear: number | null; country: string | null; gender: string | null },
  userVotes: { scenarioId: string; verdict: string }[],
  delta: 1 | -1,
): Promise<void> {
  const groups = buildDemographicGroups(userDemographics);
  if (groups.length === 0) return;

  for (const vote of userVotes) {
    if (!(VALID_VERDICTS as readonly string[]).includes(vote.verdict)) continue;
    for (const group of groups) {
      if (delta === -1) {
        // Decrement existing rows
        await db.update(demographicStats)
          .set(verdictColumnSet(vote.verdict, -1))
          .where(and(
            eq(demographicStats.scenarioId, vote.scenarioId),
            eq(demographicStats.demographicType, group.type),
            eq(demographicStats.demographicValue, group.value),
          ));
      } else {
        // Increment (upsert)
        await db.insert(demographicStats).values({
          scenarioId: vote.scenarioId,
          demographicType: group.type,
          demographicValue: group.value,
          totalVotes: 1,
          votesGuilty: vote.verdict === 'guilty' ? 1 : 0,
          votesNotGuilty: vote.verdict === 'not_guilty' ? 1 : 0,
          votesComplicated: vote.verdict === 'complicated' ? 1 : 0,
          votesBothWrong: vote.verdict === 'both_wrong' ? 1 : 0,
        }).onConflictDoUpdate({
          target: [demographicStats.scenarioId, demographicStats.demographicType, demographicStats.demographicValue],
          set: verdictColumnSet(vote.verdict, 1),
        });
      }
    }
  }
}

/**
 * Recompute demographic stats when a user's demographics change.
 * Decrements old buckets, increments new buckets for all user's votes.
 */
export async function recomputeUserDemographicStats(
  userId: string,
  oldDemographics: { birthYear: number | null; country: string | null; gender: string | null },
  newDemographics: { birthYear: number | null; country: string | null; gender: string | null },
): Promise<void> {
  const userVotes = await db.select({
    scenarioId: votes.scenarioId,
    verdict: votes.verdict,
  }).from(votes).where(eq(votes.userId, userId));

  if (userVotes.length === 0) return;

  // Decrement old demographic buckets
  await adjustDemographicStatsForUserVotes(oldDemographics, userVotes, -1);
  // Increment new demographic buckets
  await adjustDemographicStatsForUserVotes(newDemographics, userVotes, 1);
}

/**
 * Remove a user's demographic contributions from aggregated stats (for DELETE endpoint).
 */
export async function removeUserDemographicStats(
  userId: string,
  demographics: { birthYear: number | null; country: string | null; gender: string | null },
): Promise<void> {
  const userVotes = await db.select({
    scenarioId: votes.scenarioId,
    verdict: votes.verdict,
  }).from(votes).where(eq(votes.userId, userId));

  if (userVotes.length === 0) return;

  await adjustDemographicStatsForUserVotes(demographics, userVotes, -1);
}

/**
 * Backfill demographic_stats for all historical votes.
 * Useful after initial migration — call once to populate stats for existing votes.
 */
export async function backfillDemographicStats(): Promise<{ processed: number }> {
  const allVotes = await db.select({
    scenarioId: votes.scenarioId,
    verdict: votes.verdict,
    userId: votes.userId,
  }).from(votes);

  // Build a map of user demographics for efficient lookup
  const allUsers = await db.select({
    id: users.id,
    birthYear: users.birthYear,
    country: users.country,
    gender: users.gender,
  }).from(users);
  const userMap = new Map(allUsers.map(u => [u.id, u]));

  let processed = 0;
  for (const vote of allVotes) {
    const user = userMap.get(vote.userId);
    if (!user) continue;
    if (!(VALID_VERDICTS as readonly string[]).includes(vote.verdict)) continue;

    const groups = buildDemographicGroups(user);
    for (const group of groups) {
      await db.insert(demographicStats).values({
        scenarioId: vote.scenarioId,
        demographicType: group.type,
        demographicValue: group.value,
        totalVotes: 1,
        votesGuilty: vote.verdict === 'guilty' ? 1 : 0,
        votesNotGuilty: vote.verdict === 'not_guilty' ? 1 : 0,
        votesComplicated: vote.verdict === 'complicated' ? 1 : 0,
        votesBothWrong: vote.verdict === 'both_wrong' ? 1 : 0,
      }).onConflictDoUpdate({
        target: [demographicStats.scenarioId, demographicStats.demographicType, demographicStats.demographicValue],
        set: verdictColumnSet(vote.verdict, 1),
      });
    }
    processed++;
  }
  return { processed };
}
