import AsyncStorage from '@react-native-async-storage/async-storage';
import { analytics } from './analytics';
import { hasAnalyticsConsent, loadConsent, subscribeConsent } from './consent';

// Bridge between consent state and the analytics singleton.
// Keeps `analytics.ts` untouched while enforcing GDPR: when the user has not
// granted analytics consent, track/screen/identify become no-ops AND any
// previously persisted queue is cleared.
//
// Call `applyAnalyticsConsent()` once at app startup (before any track call
// fires) and it will also subscribe to future consent changes.

const ANALYTICS_QUEUE_KEY = 'spicypick_analytics_queue';

type TrackFn = typeof analytics.track;
type ScreenFn = typeof analytics.screen;
type IdentifyFn = typeof analytics.identify;

const originalTrack: TrackFn = analytics.track.bind(analytics);
const originalScreen: ScreenFn = analytics.screen.bind(analytics);
const originalIdentify: IdentifyFn = analytics.identify.bind(analytics);

let installed = false;
let consentActive = false;

const noopTrack: TrackFn = () => {};
const noopScreen: ScreenFn = () => {};
const noopIdentify: IdentifyFn = () => {};

function enable(): void {
  analytics.track = originalTrack;
  analytics.screen = originalScreen;
  analytics.identify = originalIdentify;
  consentActive = true;
}

function disable(): void {
  analytics.track = noopTrack;
  analytics.screen = noopScreen;
  analytics.identify = noopIdentify;
  consentActive = false;
}

async function clearPersistedQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ANALYTICS_QUEUE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export async function applyAnalyticsConsent(): Promise<void> {
  // Default to disabled until we know consent state — prevents the first
  // track('app_open') in _layout from leaking before loadConsent resolves.
  if (!installed) {
    disable();
    installed = true;
    subscribeConsent((state) => {
      if (state?.level === 'all') {
        enable();
        analytics.init().catch(() => {});
      } else {
        disable();
        clearPersistedQueue();
      }
    });
  }

  await loadConsent();
  if (hasAnalyticsConsent()) {
    enable();
    await analytics.init();
  } else {
    disable();
    await clearPersistedQueue();
  }
}

export function isAnalyticsEnabled(): boolean {
  return consentActive;
}
