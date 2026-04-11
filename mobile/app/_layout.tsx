import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/authStore';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import '../src/i18n';

function RootLayoutInner() {
  const { fetchProfile, isAuthenticated } = useAuthStore();
  const { isDark, colors } = useTheme();

  useEffect(() => {
    fetchProfile();
  }, []);

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
