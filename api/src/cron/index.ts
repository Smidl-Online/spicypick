import cron from 'node-cron';
import { publishDailyScenario } from './publishDailyScenario.js';
import { processWeeklyLeagues } from './processWeeklyLeagues.js';
import { sendStreakWarnings } from './sendStreakWarnings.js';
import { generateExpertAnalysis } from './generateExpertAnalysis.js';
import { sendDailyNotification } from './sendDailyNotification.js';
import { sendLeagueNotifications } from './sendLeagueNotifications.js';

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

  // Send streak warnings at 20:00 LOCAL time (runs hourly, filters by timezone)
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Checking streak warnings for current timezone group...');
    try {
      await sendStreakWarnings();
      console.log('[CRON] Streak warnings check done.');
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

  // Send daily scenario notification at 9:00 LOCAL time (runs hourly, filters by timezone)
  cron.schedule('5 * * * *', async () => {
    console.log('[CRON] Checking daily notifications for current timezone group...');
    try {
      await sendDailyNotification();
      console.log('[CRON] Daily notifications check done.');
    } catch (err) {
      console.error('[CRON] Failed to send daily notifications:', err);
    }
  });

  // Send league result notifications at Monday 10:00 LOCAL time (runs hourly, filters by timezone + day)
  cron.schedule('10 * * * *', async () => {
    console.log('[CRON] Checking league notifications for current timezone group...');
    try {
      await sendLeagueNotifications();
      console.log('[CRON] League notifications check done.');
    } catch (err) {
      console.error('[CRON] Failed to send league notifications:', err);
    }
  });

  console.log('[CRON] All cron jobs scheduled.');
}
