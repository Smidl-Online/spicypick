import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/authStore';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { i18nReady } from '../src/i18n';

function RootLayoutInner() {
  const { fetchProfile, isAuthenticated } = useAuthStore();
  const { isDark, colors } = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    i18nReady.then(() => setReady(true));
    fetchProfile();
  }, []);

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
            <Stack.Screen name="settings" />
          </>
        )}
      </Stack>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}
