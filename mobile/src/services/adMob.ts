import { Platform } from 'react-native';

// AdMob unit IDs — test IDs for development, production IDs from env/config
const INTERSTITIAL_AD_UNIT_ID = __DEV__
  ? Platform.select({
      ios: 'ca-app-pub-3940256099942544/4411468910', // Google test interstitial iOS
      android: 'ca-app-pub-3940256099942544/1033173712', // Google test interstitial Android
    }) || ''
  : Platform.select({
      ios: process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL || '',
      android: process.env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL || '',
    }) || '';

type InterstitialState = {
  loaded: boolean;
  loading: boolean;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type AdModule = {
  InterstitialAd: {
    createForAdRequest: (adUnitId: string, opts?: { keywords?: string[] }) => {
      addAdEventListener: (event: string, cb: () => void) => () => void;
      load: () => void;
      show: () => Promise<void>;
    };
  };
  AdEventType: {
    LOADED: string;
    CLOSED: string;
    ERROR: string;
  };
};

/**
 * Attempt to load the react-native-google-mobile-ads module.
 * Returns null if the module is not installed (e.g. in Expo Go).
 */
function getAdMobModule(): AdModule | null {
  try {
    // Use require so the app doesn't crash if the package isn't installed.
    // The dynamic require is intentional — it allows graceful degradation.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native-google-mobile-ads') as AdModule;
  } catch {
    return null;
  }
}

/**
 * AdMob interstitial service.
 *
 * Uses react-native-google-mobile-ads when available.
 * Falls back to a no-op stub so the app builds without the native module
 * (e.g. in Expo Go or when the package is not installed).
 */
class AdMobInterstitialService {
  private state: InterstitialState = { loaded: false, loading: false };
  private interstitialAd: { show: () => Promise<void>; load: () => void } | null = null;
  private unsubscribeLoaded: (() => void) | null = null;
  private unsubscribeClosed: (() => void) | null = null;
  private unsubscribeError: (() => void) | null = null;

  /**
   * Attempt to load an interstitial ad.
   * Does nothing if the native module is unavailable.
   */
  load(): void {
    if (this.state.loading || this.state.loaded) return;

    if (!INTERSTITIAL_AD_UNIT_ID) {
      if (__DEV__) {
        console.log('[AdMob] No ad unit ID configured, ads disabled');
      }
      return;
    }

    this.state.loading = true;

    const admob = getAdMobModule();
    if (!admob) {
      if (__DEV__) {
        console.log('[AdMob] react-native-google-mobile-ads not available, ads disabled');
      }
      this.state.loading = false;
      return;
    }

    try {
      const { InterstitialAd, AdEventType } = admob;

      const ad = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID, {
        keywords: ['social', 'game', 'quiz'],
      });

      // Unsubscribe previous listeners before registering new ones (prevents leaks on reload)
      this.unsubscribeLoaded?.();
      this.unsubscribeClosed?.();
      this.unsubscribeError?.();

      this.unsubscribeLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
        this.state.loaded = true;
        this.state.loading = false;
      });

      this.unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        this.state.loaded = false;
        // Preload next ad
        this.load();
      });

      this.unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, () => {
        if (__DEV__) {
          console.log('[AdMob] Interstitial ad failed to load');
        }
        this.state.loading = false;
        this.state.loaded = false;
      });

      ad.load();
      this.interstitialAd = ad;
    } catch {
      if (__DEV__) {
        console.log('[AdMob] Failed to create interstitial ad');
      }
      this.state.loading = false;
    }
  }

  /**
   * Show the interstitial ad if one is loaded.
   * Returns true if an ad was shown, false otherwise.
   */
  async show(): Promise<boolean> {
    if (!this.state.loaded || !this.interstitialAd) {
      return false;
    }

    try {
      await this.interstitialAd.show();
      this.state.loaded = false;
      return true;
    } catch (err) {
      if (__DEV__) {
        console.log('[AdMob] Failed to show interstitial:', err);
      }
      return false;
    }
  }

  /**
   * Whether an ad is currently loaded and ready to show.
   */
  isReady(): boolean {
    return this.state.loaded;
  }

  destroy(): void {
    this.unsubscribeLoaded?.();
    this.unsubscribeClosed?.();
    this.unsubscribeError?.();
    this.interstitialAd = null;
    this.state = { loaded: false, loading: false };
  }
}

export const adMobInterstitial = new AdMobInterstitialService();
