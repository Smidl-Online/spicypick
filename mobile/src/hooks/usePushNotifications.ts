import { useEffect, useRef, useCallback } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from '../api/client';

/**
 * Requests push notification permissions, obtains Expo push token,
 * and registers it with the backend. Re-registers on every app foreground
 * to handle token changes (app updates, reinstalls).
 */
export function usePushNotifications(isAuthenticated: boolean) {
  const lastToken = useRef<string | null>(null);

  const register = useCallback(async () => {
    const token = await registerForPushNotifications(lastToken.current);
    if (token) {
      lastToken.current = token;
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      lastToken.current = null;
      return;
    }

    register();

    // Re-register when app comes back to foreground (token may have changed)
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && isAuthenticated) {
        register();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, register]);
}

async function registerForPushNotifications(previousToken: string | null): Promise<string | null> {
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

    // Skip server call if token hasn't changed
    if (token === previousToken) {
      return token;
    }

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

/**
 * Get current push notification permission status.
 * Returns 'granted', 'denied', or 'undetermined'.
 */
export async function getPushPermissionStatus(): Promise<string> {
  if (!Device.isDevice) return 'unsupported';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch {
    return 'undetermined';
  }
}
