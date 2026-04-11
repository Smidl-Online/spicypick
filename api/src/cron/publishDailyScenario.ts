import { db } from '../db/index.js';
import { scenarios } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

export async function publishDailyScenario() {
  const today = new Date().toISOString().split('T')[0];

  // Find scenario scheduled for today
  const scenario = await db.query.scenarios.findFirst({
    where: and(
      eq(scenarios.publishDate, today),
      eq(scenarios.status, 'scheduled'),
    ),
  });

  if (!scenario) {
    console.log(`[CRON] No scenario scheduled for ${today}`);
    return;
  }

  await db.update(scenarios).set({ status: 'published' }).where(eq(scenarios.id, scenario.id));
  console.log(`[CRON] Published scenario "${scenario.title}" for ${today}`);
}
