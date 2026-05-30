import AsyncStorage from '@react-native-async-storage/async-storage';

export const CONSENT_STORAGE_KEY = 'gdpr_consent_v1';

export type ConsentLevel = 'all' | 'essential';

export type ConsentState = {
  level: ConsentLevel;
  acceptedAt: string;
};

let cache: ConsentState | null = null;
const listeners = new Set<(state: ConsentState | null) => void>();

export async function loadConsent(): Promise<ConsentState | null> {
  try {
    const raw = await AsyncStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) {
      cache = null;
      return null;
    }
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed?.level !== 'all' && parsed?.level !== 'essential') {
      cache = null;
      return null;
    }
    cache = parsed;
    return parsed;
  } catch {
    cache = null;
    return null;
  }
}

export async function saveConsent(level: ConsentLevel): Promise<ConsentState> {
  const state: ConsentState = { level, acceptedAt: new Date().toISOString() };
  await AsyncStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state));
  cache = state;
  for (const l of listeners) l(state);
  return state;
}

export function getConsentSync(): ConsentState | null {
  return cache;
}

export function hasAnalyticsConsent(): boolean {
  return cache?.level === 'all';
}

export function subscribeConsent(listener: (state: ConsentState | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
