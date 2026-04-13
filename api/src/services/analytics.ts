const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY || '';
const POSTHOG_HOST = process.env.POSTHOG_HOST || 'https://eu.i.posthog.com';
const FLUSH_INTERVAL_MS = 10_000; // 10 seconds
const MAX_QUEUE_SIZE = 500;

type AnalyticsEvent = {
  event: string;
  properties: Record<string, unknown>;
  timestamp: string;
  distinct_id: string;
};

class ServerAnalytics {
  private queue: AnalyticsEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;

  init(): void {
    if (this.flushTimer) return;

    this.flushTimer = setInterval(() => {
      this.flush();
    }, FLUSH_INTERVAL_MS);

    if (!POSTHOG_API_KEY) {
      console.log('PostHog API key not configured, analytics events will be logged only');
    } else {
      console.log('PostHog server-side analytics initialized');
    }
  }

  /**
   * Track a server-side event for a specific user.
   */
  track(
    event: string,
    userId: string,
    properties?: Record<string, unknown>,
  ): void {
    const analyticsEvent: AnalyticsEvent = {
      event,
      properties: {
        ...properties,
        $lib: 'spicypick-api',
      },
      timestamp: new Date().toISOString(),
      distinct_id: userId,
    };

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Analytics] ${event}`, { userId, ...properties });
    }

    this.queue.push(analyticsEvent);

    if (this.queue.length > MAX_QUEUE_SIZE) {
      this.queue = this.queue.slice(-MAX_QUEUE_SIZE);
    }
  }

  /**
   * Identify a user with traits (e.g., after registration or profile update).
   */
  identify(userId: string, traits?: Record<string, unknown>): void {
    this.track('$identify', userId, {
      $set: traits || {},
      $user_id: userId,
    });
  }

  async flush(): Promise<void> {
    if (this.flushing || this.queue.length === 0) return;
    this.flushing = true;

    const batch = [...this.queue];
    this.queue = [];

    if (!POSTHOG_API_KEY) {
      this.flushing = false;
      return;
    }

    try {
      const response = await fetch(`${POSTHOG_HOST}/batch/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: POSTHOG_API_KEY,
          batch: batch.map((e) => ({
            event: e.event,
            properties: {
              ...e.properties,
              distinct_id: e.distinct_id,
            },
            timestamp: e.timestamp,
          })),
        }),
      });

      if (!response.ok) {
        // Re-queue on failure
        this.queue = [...batch, ...this.queue].slice(0, MAX_QUEUE_SIZE);
        console.error(`[Analytics] Flush failed: ${response.status}`);
      }
    } catch (err) {
      this.queue = [...batch, ...this.queue].slice(0, MAX_QUEUE_SIZE);
      console.error('[Analytics] Flush error:', err);
    } finally {
      this.flushing = false;
    }
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}

export const analytics = new ServerAnalytics();
