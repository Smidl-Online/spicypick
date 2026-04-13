import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import authRoutes from './routes/auth.js';
import scenarioRoutes from './routes/scenarios.js';
import userRoutes from './routes/users.js';
import leagueRoutes from './routes/leagues.js';
import achievementRoutes from './routes/achievements.js';
import challengeRoutes from './routes/challenges.js';
import submissionRoutes from './routes/submissions.js';
import premiumRoutes from './routes/premium.js';
import reportRoutes from './routes/reports.js';
import guildRoutes from './routes/guilds.js';
import adminRoutes from './routes/admin.js';
import wellknownRoutes from './routes/wellknown.js';
import deeplinkRoutes from './routes/deeplink.js';
import { rateLimit } from './middleware/rateLimit.js';
import { startCronJobs } from './cron/index.js';
import { initSentry } from './services/sentry.js';
import { analytics } from './services/analytics.js';

// Validate required env variables at startup
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`FATAL: Missing required environment variable: ${key}`);
  }
}
if (!process.env.ADMIN_TOKEN) {
  console.warn('WARNING: ADMIN_TOKEN not set — admin panel will be disabled');
}

const app = new Hono();

// Global middleware
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use('*', cors({ origin: corsOrigin }));
app.use('*', logger());
app.use('/api/*', rateLimit(100, 60_000));
app.use('/admin/*', rateLimit(30, 60_000));

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Well-known files (universal links / app links verification)
app.route('/.well-known', wellknownRoutes);

// Deep link fallback pages (scenario web preview + app store redirect)
app.route('/', deeplinkRoutes);

// Routes
app.route('/api/auth', authRoutes);
app.route('/api/scenarios', scenarioRoutes);
app.route('/api/users', userRoutes);
app.route('/api/leagues', leagueRoutes);
app.route('/api/achievements', achievementRoutes);
app.route('/api/challenges', challengeRoutes);
app.route('/api/submissions', submissionRoutes);
app.route('/api/premium', premiumRoutes);
app.route('/api/reports', reportRoutes);
app.route('/api/guilds', guildRoutes);
app.route('/admin', adminRoutes);

// 404
app.notFound((c) => c.json({ error: 'Not Found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

// Initialize services
initSentry();
analytics.init();

// Start server
const port = parseInt(process.env.PORT || '3000');
console.log(`SpicyPick API starting on port ${port}...`);

serve({ fetch: app.fetch, port }, () => {
  console.log(`SpicyPick API running on http://localhost:${port}`);
  startCronJobs();
});

export default app;
