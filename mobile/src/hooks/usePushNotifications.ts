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
export function usePushNotifications(isAuthenticated: boolean) {
  const registered = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      // Reset on logout so next login re-registers the token
      registered.current = false;
      return;
    }

    if (registered.current) return;

    registerForPushNotifications().then((token) => {
      if (token) {
        registered.current = true;
      }
    });
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
