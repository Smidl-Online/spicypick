import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Must set env before importing the module
const originalEnv = { ...process.env };

describe('revenueCat service', () => {
  beforeEach(() => {
    process.env.REVENUECAT_API_KEY = 'test-rc-key';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('validateReceipt', () => {
    it('should post receipt to RevenueCat and return subscription data', async () => {
      const mockResponse = {
        subscriber: {
          entitlements: {
            premium: {
              expires_date: new Date(Date.now() + 86400000).toISOString(),
              product_identifier: 'premium_monthly',
            },
          },
          subscriptions: {},
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { validateReceipt } = await import('../services/revenueCat.js');
      const result = await validateReceipt('user-1', 'test-receipt', 'ios');

      expect(result.isActive).toBe(true);
      expect(result.productId).toBe('premium_monthly');
      expect(result.expiresAt).toBeInstanceOf(Date);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.revenuecat.com/v1/receipts',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-rc-key',
            'X-Platform': 'ios',
          }),
        }),
      );
    });

    it('should send android platform header for android receipts', async () => {
      const mockResponse = {
        subscriber: {
          entitlements: {
            premium: {
              expires_date: new Date(Date.now() + 86400000).toISOString(),
              product_identifier: 'premium_yearly',
            },
          },
          subscriptions: {},
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { validateReceipt } = await import('../services/revenueCat.js');
      await validateReceipt('user-1', 'android-receipt', 'android');

      expect(fetch).toHaveBeenCalledWith(
        'https://api.revenuecat.com/v1/receipts',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Platform': 'android',
          }),
        }),
      );
    });

    it('should throw when RevenueCat returns error', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Invalid receipt'),
      });

      const { validateReceipt } = await import('../services/revenueCat.js');
      await expect(validateReceipt('user-1', 'bad-receipt', 'ios')).rejects.toThrow(
        'Receipt validation failed',
      );
    });

    it('should return inactive when no premium entitlement', async () => {
      const mockResponse = {
        subscriber: {
          entitlements: {},
          subscriptions: {},
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { validateReceipt } = await import('../services/revenueCat.js');
      const result = await validateReceipt('user-1', 'receipt', 'ios');

      expect(result.isActive).toBe(false);
      expect(result.expiresAt).toBeNull();
      expect(result.productId).toBeNull();
    });

    it('should return inactive for expired entitlement', async () => {
      const mockResponse = {
        subscriber: {
          entitlements: {
            premium: {
              expires_date: new Date(Date.now() - 86400000).toISOString(), // expired
              product_identifier: 'premium_monthly',
            },
          },
          subscriptions: {},
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { validateReceipt } = await import('../services/revenueCat.js');
      const result = await validateReceipt('user-1', 'receipt', 'ios');

      expect(result.isActive).toBe(false);
      expect(result.productId).toBe('premium_monthly');
    });

    it('should throw when REVENUECAT_API_KEY is not set', async () => {
      delete process.env.REVENUECAT_API_KEY;

      const { validateReceipt } = await import('../services/revenueCat.js');
      await expect(validateReceipt('user-1', 'receipt', 'ios')).rejects.toThrow(
        'REVENUECAT_API_KEY is not configured',
      );
    });
  });

  describe('getSubscriptionStatus', () => {
    it('should get subscriber status from RevenueCat', async () => {
      const expiresDate = new Date(Date.now() + 86400000);
      const mockResponse = {
        subscriber: {
          entitlements: {
            premium: {
              expires_date: expiresDate.toISOString(),
              product_identifier: 'premium_monthly',
            },
          },
          subscriptions: {},
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { getSubscriptionStatus } = await import('../services/revenueCat.js');
      const result = await getSubscriptionStatus('user-1');

      expect(result.isActive).toBe(true);
      expect(result.productId).toBe('premium_monthly');
      expect(fetch).toHaveBeenCalledWith(
        'https://api.revenuecat.com/v1/subscribers/user-1',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-rc-key',
          }),
        }),
      );
    });

    it('should return inactive for 404 subscriber', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const { getSubscriptionStatus } = await import('../services/revenueCat.js');
      const result = await getSubscriptionStatus('nonexistent-user');

      expect(result.isActive).toBe(false);
      expect(result.expiresAt).toBeNull();
    });

    it('should throw for non-404 API errors', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { getSubscriptionStatus } = await import('../services/revenueCat.js');
      await expect(getSubscriptionStatus('user-1')).rejects.toThrow(
        'RevenueCat API error: 500',
      );
    });

    it('should encode userId in URL', async () => {
      const mockResponse = {
        subscriber: {
          entitlements: {},
          subscriptions: {},
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { getSubscriptionStatus } = await import('../services/revenueCat.js');
      await getSubscriptionStatus('user@test.com');

      expect(fetch).toHaveBeenCalledWith(
        'https://api.revenuecat.com/v1/subscribers/user%40test.com',
        expect.anything(),
      );
    });
  });
});
