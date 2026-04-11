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
  publishDate: date('publish_date').unique(),
  isPremiumBonus: boolean('is_premium_bonus').default(false).notNull(),

  // Stats (denormalized for speed)
  totalVotes: integer('total_votes').default(0).notNull(),
  votesGuilty: integer('votes_guilty').default(0).notNull(),
  votesNotGuilty: integer('votes_not_guilty').default(0).notNull(),
  votesComplicated: integer('votes_complicated').default(0).notNull(),
  votesBothWrong: integer('votes_both_wrong').default(0).notNull(),

  // Meta
  source: varchar('source', { length: 50 }),
  status: varchar('status', { length: 20 }).default('draft').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_scenarios_publish_date').on(table.publishDate),
  index('idx_scenarios_status').on(table.status),
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
  token: varchar('token', { length: 500 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_refresh_tokens_user').on(table.userId),
  index('idx_refresh_tokens_token').on(table.token),
]);

// ============================================
// GUILDS (team competitions)
// ============================================
export const guilds = pgTable('guilds', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 50 }).unique().notNull(),
  description: text('description'),
  avatarUrl: text('avatar_url'),
  leaderId: uuid('leader_id').notNull().references(() => users.id),
  weeklyXp: integer('weekly_xp').default(0).notNull(),
  totalXp: integer('total_xp').default(0).notNull(),
  memberCount: integer('member_count').default(1).notNull(),
  maxMembers: integer('max_members').default(30).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const guildMembers = pgTable('guild_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  role: varchar('role', { length: 20 }).default('member').notNull(), // 'leader', 'officer', 'member'
  weeklyXp: integer('weekly_xp').default(0).notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_guild_members_unique').on(table.guildId, table.userId),
  uniqueIndex('idx_guild_members_user_unique').on(table.userId),
  index('idx_guild_members_guild').on(table.guildId),
]);

// ============================================
// RELATIONS
// ============================================
export const usersRelations = relations(users, ({ many }) => ({
  votes: many(votes),
  leagueMembers: many(leagueMembers),
  userAchievements: many(userAchievements),
  submissions: many(scenarioSubmissions),
  challengesSent: many(challenges, { relationName: 'challenger' }),
  challengesReceived: many(challenges, { relationName: 'challenged' }),
  guildMemberships: many(guildMembers),
}));

export const scenariosRelations = relations(scenarios, ({ many }) => ({
  votes: many(votes),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  user: one(users, { fields: [votes.userId], references: [users.id] }),
  scenario: one(scenarios, { fields: [votes.scenarioId], references: [scenarios.id] }),
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
