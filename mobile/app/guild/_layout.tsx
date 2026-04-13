import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeContext';

export default function GuildLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
      }}
    />
  );
}
