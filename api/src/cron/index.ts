import cron from 'node-cron';
import { publishDailyScenario } from './publishDailyScenario.js';
import { processWeeklyLeagues } from './processWeeklyLeagues.js';
import { sendStreakWarnings } from './sendStreakWarnings.js';
import { generateExpertAnalysis } from './generateExpertAnalysis.js';

export function startCronJobs() {
  // Publish daily scenario at midnight UTC
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Publishing daily scenario...');
    try {
      await publishDailyScenario();
      console.log('[CRON] Daily scenario published.');
    } catch (err) {
      console.error('[CRON] Failed to publish daily scenario:', err);
    }
  });

  // Process weekly leagues every Monday at 8:00 UTC
  cron.schedule('0 8 * * 1', async () => {
    console.log('[CRON] Processing weekly leagues...');
    try {
      await processWeeklyLeagues();
      console.log('[CRON] Weekly leagues processed.');
    } catch (err) {
      console.error('[CRON] Failed to process leagues:', err);
    }
  });

  // Send streak warnings at 20:00 UTC (for UTC users — timezone-aware version would iterate per-tz)
  cron.schedule('0 20 * * *', async () => {
    console.log('[CRON] Sending streak warnings...');
    try {
      await sendStreakWarnings();
      console.log('[CRON] Streak warnings sent.');
    } catch (err) {
      console.error('[CRON] Failed to send streak warnings:', err);
    }
  });

  // Generate expert analysis at 2:00 UTC
  cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] Generating expert analysis...');
    try {
      await generateExpertAnalysis();
      console.log('[CRON] Expert analysis generated.');
    } catch (err) {
      console.error('[CRON] Failed to generate expert analysis:', err);
    }
  });

  console.log('[CRON] All cron jobs scheduled.');
}
