import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from '../api/client';

/**
 * Requests push notification permissions, obtains Expo push token,
 * and registers it with the backend. Should be called when user is authenticated.
 */
const RETRY_DELAY_MS = 10_000;
const MAX_RETRIES = 3;

export function usePushNotifications(isAuthenticated: boolean) {
  const registered = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      // Reset on logout so next login re-registers the token
      registered.current = false;
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
      return;
    }

    if (registered.current) return;

    let attempt = 0;
    const tryRegister = () => {
      attempt++;
      registerForPushNotifications().then((token) => {
        if (token) {
          registered.current = true;
        } else if (attempt < MAX_RETRIES) {
          retryTimer.current = setTimeout(tryRegister, RETRY_DELAY_MS);
        }
      });
    };

    tryRegister();

    return () => {
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
    };
  }, [isAuthenticated]);
}

async function registerForPushNotifications(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log('[Push] Skipping — not a physical device');
    return null;
  }

  try {
    // Check existing permissions first
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Permission not granted');
      return null;
    }

    // Android needs a notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    // Get the Expo push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });
    const token = tokenData.data;

    // Send token to backend
    await api('/api/users/me/push-token', {
      method: 'PUT',
      body: { token },
    });

    console.log('[Push] Token registered:', token.substring(0, 30) + '...');
    return token;
  } catch (error) {
    console.error('[Push] Registration failed:', error);
    return null;
  }
}
