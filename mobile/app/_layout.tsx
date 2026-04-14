import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../src/store/authStore';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { i18nReady } from '../src/i18n';
import { initSentry } from '../src/services/sentry';
import { startNetworkListener } from '../src/services/offlineSync';
import { useScenarioStore } from '../src/store/scenarioStore';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { analytics } from '../src/services/analytics';
import { usePushNotifications } from '../src/hooks/usePushNotifications';
import { initRevenueCat, loginRevenueCat, checkPremiumStatus } from '../src/services/revenueCat';
import { api } from '../src/api/client';

// Handle push notifications when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function extractScenarioId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/scenario\/([a-f0-9-]+)/i);
    return match ? match[1] : null;
  } catch {
    // Try custom scheme: spicypick://scenario/id
    const match = url.match(/scenario\/([a-f0-9-]+)/i);
    return match ? match[1] : null;
  }
}

function RootLayoutInner() {
  const { fetchProfile, isAuthenticated, user } = useAuthStore();
  const { isDark, colors } = useTheme();
  const [ready, setReady] = useState(false);
  const fetchToday = useScenarioStore((s) => s.fetchToday);
  const router = useRouter();

  // Register push token when authenticated
  usePushNotifications(isAuthenticated);

  // Sync RevenueCat user identity and subscription status when authenticated
  useEffect(() => {
    if (user?.id) {
      loginRevenueCat(user.id)
        .then(() =>
          // Sync subscription status with backend — handles renewals/expirations while app was closed
          api('/api/premium/status').then(() => fetchProfile()).catch(() => {}),
        )
        .catch((err) => console.warn('RevenueCat login failed:', err));
    }
  }, [user?.id]);

  const handleNotificationResponse = React.useCallback((response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data;
    if (data?.type === 'daily_scenario') {
      router.push('/');
    } else if (data?.type === 'challenge' && data?.scenarioId) {
      router.push(`/scenario/${data.scenarioId}`);
    } else if (data?.type === 'league_update') {
      router.push('/(tabs)/league');
    } else if (data?.type === 'achievement') {
      router.push('/(tabs)/profile');
    }
  }, [router]);

  useEffect(() => {
    i18nReady.then(() => setReady(true)).catch(() => setReady(true));
    analytics.init();
    analytics.track('app_open');
    fetchProfile();
    initSentry();
    initRevenueCat().catch((err) => console.warn('RevenueCat init failed:', err));
    const unsubscribe = startNetworkListener(() => {
      fetchToday();
    });

    // Handle deep links
    const linkSub = Linking.addEventListener('url', ({ url }) => {
      const scenarioId = extractScenarioId(url);
      if (scenarioId) {
        router.push(`/scenario/${scenarioId}`);
      }
    });

    // Handle initial deep link (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) {
        const scenarioId = extractScenarioId(url);
        if (scenarioId) {
          // Small delay to allow navigation to mount
          setTimeout(() => router.push(`/scenario/${scenarioId}`), 500);
        }
      }
    });

    // Handle push notification taps (while app is running)
    const notifSub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response);
    });

    // Handle push notification tap on cold start
    // Only handle if notification was received within the last 30 seconds
    // to prevent navigating on stale notifications from days ago
    const COLD_START_MAX_AGE_MS = 30_000;
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response && response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        // notification.date is Unix timestamp in seconds, Date.now() returns milliseconds
        const notifDateMs = response.notification.date * 1000;
        const age = Date.now() - notifDateMs;
        if (age > 0 && age < COLD_START_MAX_AGE_MS) {
          setTimeout(() => handleNotificationResponse(response), 500);
        }
      }
    });

    return () => {
      unsubscribe();
      linkSub.remove();
      notifSub.remove();
    };
  }, [handleNotificationResponse]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen name="(auth)" />
        ) : (
          <>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="scenario" />
            <Stack.Screen name="guild" />
            <Stack.Screen name="settings" />
          </>
        )}
      </Stack>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <RootLayoutInner />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
