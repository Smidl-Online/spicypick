import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { experiments, experimentAssignments, experimentEvents } from '../db/schema.js';
import crypto from 'crypto';

/**
 * Deterministically assign a user to an experiment variant.
 * Uses a hash of (experimentKey + userId) for stable, reproducible assignment.
 */
function hashAssign(experimentKey: string, userId: string, variants: string[]): string {
  const hash = crypto
    .createHash('sha256')
    .update(`${experimentKey}:${userId}`)
    .digest('hex');
  const index = parseInt(hash.slice(0, 8), 16) % variants.length;
  return variants[index];
}

/**
 * Check if a user falls within the traffic percentage for an experiment.
 */
function isInTraffic(experimentKey: string, userId: string, trafficPercent: number): boolean {
  if (trafficPercent >= 100) return true;
  const hash = crypto
    .createHash('sha256')
    .update(`traffic:${experimentKey}:${userId}`)
    .digest('hex');
  const value = parseInt(hash.slice(0, 8), 16) % 100;
  return value < trafficPercent;
}

/**
 * Get or create an experiment assignment for a user.
 * Returns the assigned variant, or null if the user is not in the experiment traffic.
 */
export async function getOrAssignVariant(
  experimentKey: string,
  userId: string,
): Promise<string | null> {
  // Find the experiment
  const experiment = await db.query.experiments.findFirst({
    where: and(eq(experiments.key, experimentKey), eq(experiments.status, 'running')),
  });

  if (!experiment) return null;

  // Check if already assigned
  const existing = await db.query.experimentAssignments.findFirst({
    where: and(
      eq(experimentAssignments.experimentId, experiment.id),
      eq(experimentAssignments.userId, userId),
    ),
  });

  if (existing) return existing.variant;

  // Check traffic eligibility
  const variants: string[] = JSON.parse(experiment.variants);
  if (!isInTraffic(experimentKey, userId, experiment.trafficPercent)) {
    return null;
  }

  // Assign variant
  const variant = hashAssign(experimentKey, userId, variants);

  await db.insert(experimentAssignments).values({
    experimentId: experiment.id,
    userId,
    variant,
  }).onConflictDoNothing();

  return variant;
}

/**
 * Get all active experiment assignments for a user.
 */
export async function getUserExperiments(userId: string): Promise<Record<string, string>> {
  const runningExperiments = await db.query.experiments.findMany({
    where: eq(experiments.status, 'running'),
  });

  const result: Record<string, string> = {};

  for (const exp of runningExperiments) {
    const variant = await getOrAssignVariant(exp.key, userId);
    if (variant !== null) {
      result[exp.key] = variant;
    }
  }

  return result;
}

/**
 * Track a conversion event for an experiment.
 */
export async function trackExperimentEvent(
  experimentKey: string,
  userId: string,
  eventType: string,
  eventValue: number = 1,
  metadata?: Record<string, unknown>,
): Promise<boolean> {
  const experiment = await db.query.experiments.findFirst({
    where: eq(experiments.key, experimentKey),
  });

  if (!experiment) return false;

  // Get user's assignment
  const assignment = await db.query.experimentAssignments.findFirst({
    where: and(
      eq(experimentAssignments.experimentId, experiment.id),
      eq(experimentAssignments.userId, userId),
    ),
  });

  if (!assignment) return false;

  await db.insert(experimentEvents).values({
    experimentId: experiment.id,
    userId,
    variant: assignment.variant,
    eventType,
    eventValue,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });

  return true;
}

/**
 * Get experiment results with conversion stats per variant.
 */
export async function getExperimentResults(experimentKey: string) {
  const experiment = await db.query.experiments.findFirst({
    where: eq(experiments.key, experimentKey),
  });

  if (!experiment) return null;

  const variants: string[] = JSON.parse(experiment.variants);

  const stats = await Promise.all(
    variants.map(async (variant) => {
      const [assignmentCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(experimentAssignments)
        .where(
          and(
            eq(experimentAssignments.experimentId, experiment.id),
            eq(experimentAssignments.variant, variant),
          ),
        );

      const [eventCount] = await db
        .select({
          count: sql<number>`count(*)::int`,
          totalValue: sql<number>`coalesce(sum(${experimentEvents.eventValue}), 0)::int`,
        })
        .from(experimentEvents)
        .where(
          and(
            eq(experimentEvents.experimentId, experiment.id),
            eq(experimentEvents.variant, variant),
          ),
        );

      return {
        variant,
        participants: assignmentCount.count,
        conversions: eventCount.count,
        totalValue: eventCount.totalValue,
        conversionRate:
          assignmentCount.count > 0
            ? (eventCount.count / assignmentCount.count) * 100
            : 0,
      };
    }),
  );

  return {
    experiment: {
      id: experiment.id,
      key: experiment.key,
      name: experiment.name,
      status: experiment.status,
      variants,
      trafficPercent: experiment.trafficPercent,
      startedAt: experiment.startedAt,
      endedAt: experiment.endedAt,
    },
    stats,
  };
}
