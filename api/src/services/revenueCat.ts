const REVENUECAT_API_URL = 'https://api.revenuecat.com/v1';

interface RevenueCatSubscriberResponse {
  subscriber: {
    entitlements: Record<string, {
      expires_date: string | null;
      product_identifier: string;
    }>;
    subscriptions: Record<string, {
      expires_date: string;
      purchase_date: string;
      product_identifier: string;
      is_sandbox: boolean;
    }>;
  };
}

export interface SubscriptionResult {
  isActive: boolean;
  expiresAt: Date | null;
  productId: string | null;
}

function getApiKey(): string {
  const key = process.env.REVENUECAT_API_KEY;
  if (!key) throw new Error('REVENUECAT_API_KEY is not configured');
  return key;
}

export async function getSubscriptionStatus(userId: string): Promise<SubscriptionResult> {
  const apiKey = getApiKey();

  const response = await fetch(`${REVENUECAT_API_URL}/subscribers/${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    if (response.status === 404) {
      return { isActive: false, expiresAt: null, productId: null };
    }
    throw new Error(`RevenueCat API error: ${response.status}`);
  }

  const data = await response.json() as RevenueCatSubscriberResponse;
  return parseSubscriberData(data);
}

function parseSubscriberData(data: RevenueCatSubscriberResponse): SubscriptionResult {
  const premiumEntitlement = data.subscriber.entitlements?.['premium'];

  if (!premiumEntitlement || !premiumEntitlement.expires_date) {
    return { isActive: false, expiresAt: null, productId: null };
  }

  const expiresAt = new Date(premiumEntitlement.expires_date);
  const isActive = expiresAt > new Date();

  return {
    isActive,
    expiresAt,
    productId: premiumEntitlement.product_identifier || null,
  };
}
