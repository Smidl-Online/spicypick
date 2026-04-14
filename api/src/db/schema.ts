import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  date,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================
// USERS
// ============================================
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  username: varchar('username', { length: 30 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),

  // Gamification
  xp: integer('xp').default(0).notNull(),
  level: integer('level').default(1).notNull(),
  currentStreak: integer('current_streak').default(0).notNull(),
  longestStreak: integer('longest_streak').default(0).notNull(),
  streakFreezes: integer('streak_freezes').default(1).notNull(),
  lastPlayedAt: date('last_played_at'),

  // Premium
  isPremium: boolean('is_premium').default(false).notNull(),
  premiumUntil: timestamp('premium_until'),

  // Admin
  isAdmin: boolean('is_admin').default(false).notNull(),

  // Demographics (optional)
  birthYear: integer('birth_year'),
  country: varchar('country', { length: 2 }),
  gender: varchar('gender', { length: 20 }),

  // Meta
  locale: varchar('locale', { length: 5 }).default('en').notNull(),
  timezone: varchar('timezone', { length: 50 }).default('UTC').notNull(),
  pushToken: text('push_token'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================
// SCENARIOS (daily content)
// ============================================
export const scenarios = pgTable('scenarios', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Content
  title: varchar('title', { length: 120 }).notNull(),
  body: text('body').notNull(),
  category: varchar('category', { length: 30 }).notNull(),
  expertAnalysis: text('expert_analysis'),
  outcome: text('outcome'),

  // Scheduling
  publishDate: date('publish_date'),
  isPremiumBonus: boolean('is_premium_bonus').default(false).notNull(),
  pack: varchar('pack', { length: 50 }),

  // Stats (denormalized for speed)
  totalVotes: integer('total_votes').default(0).notNull(),
  votesGuilty: integer('votes_guilty').default(0).notNull(),
  votesNotGuilty: integer('votes_not_guilty').default(0).notNull(),
  votesComplicated: integer('votes_complicated').default(0).notNull(),
  votesBothWrong: integer('votes_both_wrong').default(0).notNull(),

  // Meta
  source: varchar('source', { length: 50 }),
  status: varchar('status', { length: 20 }).default('draft').notNull(),
  locale: varchar('locale', { length: 5 }).default('en').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_scenarios_publish_date_locale').on(table.publishDate, table.locale),
  index('idx_scenarios_status').on(table.status),
  index('idx_scenarios_pack').on(table.pack),
]);

// ============================================
// VOTES (user verdicts)
// ============================================
export const votes = pgTable('votes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  scenarioId: uuid('scenario_id').notNull().references(() => scenarios.id),
  verdict: varchar('verdict', { length: 20 }).notNull(),
  xpEarned: integer('xp_earned').default(0).notNull(),
  votedAt: timestamp('voted_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_votes_user_scenario').on(table.userId, table.scenarioId),
  index('idx_votes_user').on(table.userId),
  index('idx_votes_scenario').on(table.scenarioId),
]);

// ============================================
// PREDICTIONS (prediction mode)
// ============================================
export const predictions = pgTable('predictions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  scenarioId: uuid('scenario_id').notNull().references(() => scenarios.id),
  predictedVerdict: varchar('predicted_verdict', { length: 20 }).notNull(),
  isCorrect: boolean('is_correct'),
  xpEarned: integer('xp_earned').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_predictions_user_scenario').on(table.userId, table.scenarioId),
  index('idx_predictions_user').on(table.userId),
  index('idx_predictions_scenario').on(table.scenarioId),
]);

// ============================================
// LEAGUES (weekly competition)
// ============================================
export const leagues = pgTable('leagues', {
  id: uuid('id').defaultRandom().primaryKey(),
  tier: varchar('tier', { length: 20 }).notNull(),
  weekStart: date('week_start').notNull(),
  weekEnd: date('week_end').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const leagueMembers = pgTable('league_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  leagueId: uuid('league_id').notNull().references(() => leagues.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  weeklyXp: integer('weekly_xp').default(0).notNull(),
  finalRank: integer('final_rank'),
  promoted: boolean('promoted').default(false).notNull(),
  demoted: boolean('demoted').default(false).notNull(),
}, (table) => [
  uniqueIndex('idx_league_members_unique').on(table.leagueId, table.userId),
  index('idx_league_members_league').on(table.leagueId),
  index('idx_league_members_user').on(table.userId),
]);

// ============================================
// ACHIEVEMENTS
// ============================================
export const achievements = pgTable('achievements', {
  id: varchar('id', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description').notNull(),
  icon: varchar('icon', { length: 50 }).notNull(),
  xpReward: integer('xp_reward').default(0).notNull(),
});

export const userAchievements = pgTable('user_achievements', {
  userId: uuid('user_id').notNull().references(() => users.id),
  achievementId: varchar('achievement_id', { length: 50 }).notNull().references(() => achievements.id),
  unlockedAt: timestamp('unlocked_at').defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.achievementId] }),
]);

// ============================================
// SCENARIO SUBMISSIONS (user-generated content)
// ============================================
export const scenarioSubmissions = pgTable('scenario_submissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  body: text('body').notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  moderatorNotes: text('moderator_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// FRIEND CHALLENGES
// ============================================
export const challenges = pgTable('challenges', {
  id: uuid('id').defaultRandom().primaryKey(),
  challengerId: uuid('challenger_id').references(() => users.id),
  challengedId: uuid('challenged_id').references(() => users.id),
  scenarioId: uuid('scenario_id').references(() => scenarios.id),
  challengerVerdict: varchar('challenger_verdict', { length: 20 }),
  challengedVerdict: varchar('challenged_verdict', { length: 20 }),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// REPORTS (community moderation)
// ============================================
export const reports = pgTable('reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  scenarioId: uuid('scenario_id').notNull().references(() => scenarios.id),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_reports_user_scenario').on(table.userId, table.scenarioId),
]);

// ============================================
// REFRESH TOKENS
// ============================================
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  tokenHash: varchar('token_hash', { length: 128 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_refresh_tokens_user').on(table.userId),
  index('idx_refresh_tokens_token_hash').on(table.tokenHash),
]);

// ============================================
// PASSWORD RESET TOKENS
// ============================================
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_password_reset_user').on(table.userId),
]);

// ============================================
// GUILDS (team competitions)
// ============================================
export const guilds = pgTable('guilds', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 50 }).unique().notNull(),
  description: text('description'),
  avatarUrl: text('avatar_url'),
  leaderId: uuid('leader_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  weeklyXp: integer('weekly_xp').default(0).notNull(),
  totalXp: integer('total_xp').default(0).notNull(),
  memberCount: integer('member_count').default(1).notNull(),
  maxMembers: integer('max_members').default(30).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const guildMembers = pgTable('guild_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).default('member').notNull(), // 'leader', 'officer', 'member'
  weeklyXp: integer('weekly_xp').default(0).notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_guild_members_unique').on(table.guildId, table.userId),
  uniqueIndex('idx_guild_members_user_unique').on(table.userId),
  index('idx_guild_members_guild').on(table.guildId),
]);

// ============================================
// MORAL PROFILES (personalized moral dimensions)
// ============================================
export const moralProfiles = pgTable('moral_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  forgiving: integer('forgiving').default(50).notNull(),
  pragmatic: integer('pragmatic').default(50).notNull(),
  empathetic: integer('empathetic').default(50).notNull(),
  confrontational: integer('confrontational').default(50).notNull(),
  majorityAligned: integer('majority_aligned').default(50).notNull(),
  consistent: integer('consistent').default(50).notNull(),
  totalVotesAnalyzed: integer('total_votes_analyzed').default(0).notNull(),
  lastCalculatedAt: timestamp('last_calculated_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_moral_profiles_user').on(table.userId),
]);

// ============================================
// DEMOGRAPHIC STATS (aggregated vote stats by demographic group)
// ============================================
export const demographicStats = pgTable('demographic_stats', {
  id: uuid('id').defaultRandom().primaryKey(),
  scenarioId: uuid('scenario_id').notNull().references(() => scenarios.id, { onDelete: 'cascade' }),
  demographicType: varchar('demographic_type', { length: 20 }).notNull(), // 'age_group' | 'country' | 'gender'
  demographicValue: varchar('demographic_value', { length: 20 }).notNull(), // '18-24' | 'CZ' | 'male' etc.
  totalVotes: integer('total_votes').default(0).notNull(),
  votesGuilty: integer('votes_guilty').default(0).notNull(),
  votesNotGuilty: integer('votes_not_guilty').default(0).notNull(),
  votesComplicated: integer('votes_complicated').default(0).notNull(),
  votesBothWrong: integer('votes_both_wrong').default(0).notNull(),
}, (table) => [
  uniqueIndex('idx_demo_stats_unique').on(table.scenarioId, table.demographicType, table.demographicValue),
  index('idx_demo_stats_scenario').on(table.scenarioId),
  index('idx_demo_stats_type').on(table.scenarioId, table.demographicType),
]);

// ============================================
// EXPERIMENTS (A/B testing)
// ============================================
export const experiments = pgTable('experiments', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: varchar('key', { length: 100 }).unique().notNull(), // e.g. 'notification_timing', 'reveal_animation'
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  variants: text('variants').notNull(), // JSON array: ["control", "variant_a", "variant_b"]
  trafficPercent: integer('traffic_percent').default(100).notNull(), // % of users included
  status: varchar('status', { length: 20 }).default('draft').notNull(), // draft, running, paused, completed
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_experiments_status').on(table.status),
  uniqueIndex('idx_experiments_key').on(table.key),
]);

export const experimentAssignments = pgTable('experiment_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  experimentId: uuid('experiment_id').notNull().references(() => experiments.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  variant: varchar('variant', { length: 50 }).notNull(),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_exp_assignments_unique').on(table.experimentId, table.userId),
  index('idx_exp_assignments_user').on(table.userId),
  index('idx_exp_assignments_experiment').on(table.experimentId),
]);

export const experimentEvents = pgTable('experiment_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  experimentId: uuid('experiment_id').notNull().references(() => experiments.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  variant: varchar('variant', { length: 50 }).notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(), // e.g. 'conversion', 'engagement', 'retention'
  eventValue: integer('event_value').default(1).notNull(),
  metadata: text('metadata'), // optional JSON
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_exp_events_experiment').on(table.experimentId),
  index('idx_exp_events_user').on(table.userId),
  index('idx_exp_events_type').on(table.experimentId, table.eventType),
]);

// ============================================
// APP CONFIG (key-value store for runtime settings)
// ============================================
export const appConfig = pgTable('app_config', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================
// RELATIONS
// ============================================
export const usersRelations = relations(users, ({ many, one }) => ({
  votes: many(votes),
  predictions: many(predictions),
  leagueMembers: many(leagueMembers),
  userAchievements: many(userAchievements),
  submissions: many(scenarioSubmissions),
  challengesSent: many(challenges, { relationName: 'challenger' }),
  challengesReceived: many(challenges, { relationName: 'challenged' }),
  guildMemberships: many(guildMembers),
  experimentAssignments: many(experimentAssignments),
  moralProfile: one(moralProfiles),
}));

export const moralProfilesRelations = relations(moralProfiles, ({ one }) => ({
  user: one(users, { fields: [moralProfiles.userId], references: [users.id] }),
}));

export const scenariosRelations = relations(scenarios, ({ many }) => ({
  votes: many(votes),
  predictions: many(predictions),
  demographicStats: many(demographicStats),
}));

export const demographicStatsRelations = relations(demographicStats, ({ one }) => ({
  scenario: one(scenarios, { fields: [demographicStats.scenarioId], references: [scenarios.id] }),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  user: one(users, { fields: [votes.userId], references: [users.id] }),
  scenario: one(scenarios, { fields: [votes.scenarioId], references: [scenarios.id] }),
}));

export const predictionsRelations = relations(predictions, ({ one }) => ({
  user: one(users, { fields: [predictions.userId], references: [users.id] }),
  scenario: one(scenarios, { fields: [predictions.scenarioId], references: [scenarios.id] }),
}));

export const leagueMembersRelations = relations(leagueMembers, ({ one }) => ({
  league: one(leagues, { fields: [leagueMembers.leagueId], references: [leagues.id] }),
  user: one(users, { fields: [leagueMembers.userId], references: [users.id] }),
}));

export const challengesRelations = relations(challenges, ({ one }) => ({
  challenger: one(users, { fields: [challenges.challengerId], references: [users.id], relationName: 'challenger' }),
  challenged: one(users, { fields: [challenges.challengedId], references: [users.id], relationName: 'challenged' }),
  scenario: one(scenarios, { fields: [challenges.scenarioId], references: [scenarios.id] }),
}));

export const guildsRelations = relations(guilds, ({ one, many }) => ({
  leader: one(users, { fields: [guilds.leaderId], references: [users.id] }),
  members: many(guildMembers),
}));

export const guildMembersRelations = relations(guildMembers, ({ one }) => ({
  guild: one(guilds, { fields: [guildMembers.guildId], references: [guilds.id] }),
  user: one(users, { fields: [guildMembers.userId], references: [users.id] }),
}));

export const experimentsRelations = relations(experiments, ({ many }) => ({
  assignments: many(experimentAssignments),
  events: many(experimentEvents),
}));

export const experimentAssignmentsRelations = relations(experimentAssignments, ({ one }) => ({
  experiment: one(experiments, { fields: [experimentAssignments.experimentId], references: [experiments.id] }),
  user: one(users, { fields: [experimentAssignments.userId], references: [users.id] }),
}));

export const experimentEventsRelations = relations(experimentEvents, ({ one }) => ({
  experiment: one(experiments, { fields: [experimentEvents.experimentId], references: [experiments.id] }),
  user: one(users, { fields: [experimentEvents.userId], references: [users.id] }),
}));
