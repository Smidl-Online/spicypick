import { db } from '../db/index.js';
import { demographicStats, users } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';

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

export function isValidCountry(code: string): boolean {
  return /^[A-Z]{2}$/.test(code);
}

export function isValidBirthYear(year: number): boolean {
  const currentYear = new Date().getFullYear();
  return Number.isInteger(year) && year >= 1900 && year <= currentYear - 13;
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

  const validVerdicts = ['guilty', 'not_guilty', 'complicated', 'both_wrong'];
  if (!validVerdicts.includes(verdict)) return;

  const groups: { type: string; value: string }[] = [];

  // Age group
  if (user.birthYear) {
    const ageGroup = calculateAgeGroup(user.birthYear);
    if (ageGroup) {
      groups.push({ type: 'age_group', value: ageGroup });
    }
  }

  // Country
  if (user.country) {
    groups.push({ type: 'country', value: user.country });
  }

  // Gender
  if (user.gender) {
    groups.push({ type: 'gender', value: user.gender });
  }

  // Upsert each demographic group
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
      set: {
        totalVotes: sql`${demographicStats.totalVotes} + 1`,
        ...(verdict === 'guilty' && { votesGuilty: sql`${demographicStats.votesGuilty} + 1` }),
        ...(verdict === 'not_guilty' && { votesNotGuilty: sql`${demographicStats.votesNotGuilty} + 1` }),
        ...(verdict === 'complicated' && { votesComplicated: sql`${demographicStats.votesComplicated} + 1` }),
        ...(verdict === 'both_wrong' && { votesBothWrong: sql`${demographicStats.votesBothWrong} + 1` }),
      },
    });
  }
}
