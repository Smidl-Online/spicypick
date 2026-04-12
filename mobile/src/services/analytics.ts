import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const POSTHOG_API_KEY = Constants.expoConfig?.extra?.posthogApiKey || '';
const POSTHOG_HOST = Constants.expoConfig?.extra?.posthogHost || 'https://eu.i.posthog.com';
const QUEUE_KEY = 'spicypick_analytics_queue';
const MAX_QUEUE_SIZE = 100;
const FLUSH_INTERVAL_MS = 30_000; // 30 seconds

type AnalyticsEvent = {
  event: string;
  properties: Record<string, unknown>;
  timestamp: string;
  distinct_id: string;
};

class AnalyticsService {
  private queue: AnalyticsEvent[] = [];
  private distinctId: string = 'anonymous';
  private initialized = false;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  async init(): Promise<void> {
    if (this.initialized) return;

    // Load queued events from storage — merge with any events enqueued before init
    try {
      const stored = await AsyncStorage.getItem(QUEUE_KEY);
      if (stored) {
        const persisted: AnalyticsEvent[] = JSON.parse(stored);
        // Prepend persisted events, then append any already enqueued during startup
        this.queue = [...persisted, ...this.queue].slice(0, MAX_QUEUE_SIZE);
      }
    } catch {
      // Ignore storage errors
    }

    // Start periodic flush
    this.flushTimer = setInterval(() => {
      this.flush();
    }, FLUSH_INTERVAL_MS);

    this.initialized = true;
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    this.distinctId = userId;

    this.enqueue('$identify', {
      $set: traits || {},
      $user_id: userId,
    });
  }

  track(event: string, properties?: Record<string, unknown>): void {
    this.enqueue(event, {
      ...properties,
      $os: Platform.OS,
      $os_version: Platform.Version,
      $app_version: Constants.expoConfig?.version || 'unknown',
      $lib: 'spicypick-mobile',
    });
  }

  /**
   * Track a screen view event.
   */
  screen(screenName: string, properties?: Record<string, unknown>): void {
    this.enqueue('$screen', {
      $screen_name: screenName,
      ...properties,
    });
  }

  reset(): void {
    this.distinctId = 'anonymous';
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0 || !POSTHOG_API_KEY) {
      // In dev mode without PostHog key, just clear the queue
      if (!POSTHOG_API_KEY && this.queue.length > 0) {
        if (__DEV__) {
          console.log(`[Analytics] ${this.queue.length} events (no API key, clearing)`);
        }
        this.queue = [];
        await this.persistQueue();
      }
      return;
    }

    const batch = [...this.queue];
    this.queue = [];

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
        // Put events back in queue on failure
        this.queue = [...batch, ...this.queue].slice(0, MAX_QUEUE_SIZE);
      }
    } catch {
      // Put events back on network error
      this.queue = [...batch, ...this.queue].slice(0, MAX_QUEUE_SIZE);
    }

    await this.persistQueue();
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }

  private enqueue(event: string, properties: Record<string, unknown>): void {
    const analyticsEvent: AnalyticsEvent = {
      event,
      properties,
      timestamp: new Date().toISOString(),
      distinct_id: this.distinctId,
    };

    if (__DEV__) {
      console.log(`[Analytics] ${event}`, properties);
    }

    this.queue.push(analyticsEvent);

    // Cap queue size
    if (this.queue.length > MAX_QUEUE_SIZE) {
      this.queue = this.queue.slice(-MAX_QUEUE_SIZE);
    }

    this.persistQueue();
  }

  private async persistQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch {
      // Ignore storage errors
    }
  }
}

export const analytics = new AnalyticsService();
