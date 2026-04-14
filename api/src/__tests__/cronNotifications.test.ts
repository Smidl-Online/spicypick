import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks (hoisted so vi.mock factories can reference them) ---

const { mockFindFirst, mockFindMany, mockSendBulk, mockGetTimezonesForHour, mockTodayInTimezone } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockFindMany: vi.fn(),
  mockSendBulk: vi.fn(() => Promise.resolve(0)),
  mockGetTimezonesForHour: vi.fn(() => ['Europe/Prague']),
  mockTodayInTimezone: vi.fn(() => '2026-04-14'),
}));

vi.mock('../db/index.js', () => ({
  db: {
    query: {
      users: { findFirst: mockFindFirst, findMany: mockFindMany },
      scenarios: { findFirst: mockFindFirst },
    },
  },
}));

vi.mock('../services/pushNotifications.js', () => ({
  sendBulkPushNotifications: (...args: unknown[]) => mockSendBulk(...args),
}));

vi.mock('../cron/timezoneUtils.js', () => ({
  getTimezonesForHour: (...args: unknown[]) => mockGetTimezonesForHour(...args),
  todayInTimezone: (...args: unknown[]) => mockTodayInTimezone(...args),
}));

vi.mock('../i18n/notifications.js', () => ({
  dailyScenario: { en: { title: 'New scenario!', body: 'Play now' } },
  streakWarning: { en: { title: 'Streak at risk!', body: 'Your {{streak}}-day streak is at risk!' } },
  t: (map: Record<string, { title: string; body: string }>, locale: string, replacements?: Record<string, string | number>) => {
    const strings = map[locale] || map['en'];
    if (!replacements) return strings;
    let { title, body } = strings;
    for (const [key, value] of Object.entries(replacements)) {
      title = title.replaceAll(`{{${key}}}`, String(value));
      body = body.replaceAll(`{{${key}}}`, String(value));
    }
    return { title, body };
  },
}));

// Schema needs real drizzle-orm (relations, column definitions)
// so we don't mock drizzle-orm — the DB mock handles actual queries

import { sendDailyNotification } from '../cron/sendDailyNotification.js';
import { sendStreakWarnings } from '../cron/sendStreakWarnings.js';

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-1',
  pushToken: 'ExponentPushToken[abc123]',
  timezone: 'Europe/Prague',
  locale: 'en',
  notifDaily: true,
  notifStreak: true,
  currentStreak: 5,
  lastPlayedAt: null,
  ...overrides,
});

describe('sendDailyNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTimezonesForHour.mockReturnValue(['Europe/Prague']);
    mockTodayInTimezone.mockReturnValue('2026-04-14');
  });

  it('should skip when no timezones match target hour', async () => {
    mockGetTimezonesForHour.mockReturnValue([]);
    await sendDailyNotification();
    expect(mockSendBulk).not.toHaveBeenCalled();
  });

  it('should skip when no published scenario exists', async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    await sendDailyNotification();
    expect(mockSendBulk).not.toHaveBeenCalled();
  });

  it('should send notifications to eligible users', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'scenario-1', publishDate: '2026-04-14', status: 'published' });
    mockFindMany.mockResolvedValueOnce([
      makeUser(),
      makeUser({ id: 'user-2', pushToken: 'ExponentPushToken[def456]' }),
    ]);
    mockSendBulk.mockResolvedValueOnce(2);

    await sendDailyNotification();

    expect(mockSendBulk).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          pushToken: 'ExponentPushToken[abc123]',
          title: 'New scenario!',
          data: expect.objectContaining({ type: 'daily_scenario', scenarioId: 'scenario-1' }),
        }),
      ]),
    );
  });

  it('should filter out users who already played today', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'scenario-1', publishDate: '2026-04-14', status: 'published' });
    mockFindMany.mockResolvedValueOnce([
      makeUser({ lastPlayedAt: '2026-04-14' }),
    ]);

    await sendDailyNotification();
    expect(mockSendBulk).not.toHaveBeenCalled();
  });

  it('should filter out users with daily notifications disabled', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'scenario-1', publishDate: '2026-04-14', status: 'published' });
    mockFindMany.mockResolvedValueOnce([
      makeUser({ notifDaily: false }),
    ]);

    await sendDailyNotification();
    expect(mockSendBulk).not.toHaveBeenCalled();
  });
});

describe('sendStreakWarnings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTimezonesForHour.mockReturnValue(['Europe/Prague']);
    mockTodayInTimezone.mockReturnValue('2026-04-14');
  });

  it('should skip when no timezones match target hour', async () => {
    mockGetTimezonesForHour.mockReturnValue([]);
    await sendStreakWarnings();
    expect(mockSendBulk).not.toHaveBeenCalled();
  });

  it('should send streak warnings to at-risk users', async () => {
    mockFindMany.mockResolvedValueOnce([
      makeUser({ currentStreak: 7 }),
    ]);
    mockSendBulk.mockResolvedValueOnce(1);

    await sendStreakWarnings();

    expect(mockSendBulk).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          pushToken: 'ExponentPushToken[abc123]',
          title: 'Streak at risk!',
          body: 'Your 7-day streak is at risk!',
          data: expect.objectContaining({ type: 'streak_warning' }),
        }),
      ]),
    );
  });

  it('should filter out users who already played today', async () => {
    mockFindMany.mockResolvedValueOnce([
      makeUser({ currentStreak: 3, lastPlayedAt: '2026-04-14' }),
    ]);

    await sendStreakWarnings();
    expect(mockSendBulk).not.toHaveBeenCalled();
  });

  it('should filter out users with streak notifications disabled', async () => {
    mockFindMany.mockResolvedValueOnce([
      makeUser({ currentStreak: 5, notifStreak: false }),
    ]);

    await sendStreakWarnings();
    expect(mockSendBulk).not.toHaveBeenCalled();
  });

  it('should include streak count in notification body', async () => {
    mockFindMany.mockResolvedValueOnce([
      makeUser({ currentStreak: 15 }),
    ]);
    mockSendBulk.mockResolvedValueOnce(1);

    await sendStreakWarnings();

    expect(mockSendBulk).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          body: expect.stringContaining('15'),
        }),
      ]),
    );
  });
});
