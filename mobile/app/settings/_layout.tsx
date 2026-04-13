import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeContext';

export default function SettingsLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="premium" options={{ title: 'Premium' }} />
      <Stack.Screen name="creator-mode" options={{ title: 'Creator Mode', headerShown: false, animation: 'fade' }} />
    </Stack>
  );
}
