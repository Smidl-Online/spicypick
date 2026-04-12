import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock expo-server-sdk
vi.mock('expo-server-sdk', () => {
  const mockSendPushNotificationsAsync = vi.fn(() => Promise.resolve([{ status: 'ok' }]));
  const mockChunkPushNotifications = vi.fn((msgs: any[]) => [msgs]);

  class MockExpo {
    sendPushNotificationsAsync = mockSendPushNotificationsAsync;
    chunkPushNotifications = mockChunkPushNotifications;
    static isExpoPushToken(token: string) {
      return token.startsWith('ExponentPushToken[');
    }
  }

  return {
    default: MockExpo,
    __esModule: true,
    Expo: MockExpo,
  };
});

import { sendPushNotification, sendBulkPushNotifications } from '../services/pushNotifications.js';

describe('push notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendPushNotification', () => {
    it('should skip invalid push tokens', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await sendPushNotification('invalid-token', {
        title: 'Test',
        body: 'Test body',
      });
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid push token'));
      consoleSpy.mockRestore();
    });

    it('should send notification with valid Expo token', async () => {
      await sendPushNotification('ExponentPushToken[abc123]', {
        title: 'Test',
        body: 'Test body',
        data: { type: 'test' },
      });
      // No error thrown = success
    });
  });

  describe('sendBulkPushNotifications', () => {
    it('should filter out invalid tokens', async () => {
      const sent = await sendBulkPushNotifications([
        { pushToken: 'invalid', title: 'Test', body: 'Body' },
        { pushToken: 'also-invalid', title: 'Test2', body: 'Body2' },
      ]);
      expect(sent).toBe(0);
    });

    it('should send valid notifications', async () => {
      const sent = await sendBulkPushNotifications([
        { pushToken: 'ExponentPushToken[abc123]', title: 'Test', body: 'Body' },
      ]);
      expect(sent).toBe(1);
    });
  });
});
