import { analytics } from './analytics';
import { hasAnalyticsConsent, loadConsent, subscribeConsent } from './consent';

// Bridge between consent state and the analytics singleton.
// Keeps `analytics.ts` untouched while enforcing GDPR: when the user has not
// granted analytics consent, track/screen/identify become no-ops AND any
// previously queued events (in-memory + persisted) are immediately discarded.
//
// Call `applyAnalyticsConsent()` once at app startup (before any track call
// fires) and it will also subscribe to future consent changes.

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

// Eagerly gate analytics from import time — before any React render or useEffect.
// This guarantees child screens cannot fire track() before consent is loaded,
// even if their own effects run before the parent layout's useEffect.
analytics.track = noopTrack;
analytics.screen = noopScreen;
analytics.identify = noopIdentify;

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
  // Stop flush timer + clear in-memory queue + persist empty queue.
  // GDPR: consent revocation must be immediate — no pending events may be sent.
  analytics.clearQueue();
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
      }
    });
  }

  await loadConsent();
  if (hasAnalyticsConsent()) {
    enable();
    await analytics.init();
  } else {
    disable();
  }
}

export function isAnalyticsEnabled(): boolean {
  return consentActive;
}
