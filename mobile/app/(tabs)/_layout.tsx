import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useTheme } from '../../src/theme/ThemeContext';
import { useTranslation } from 'react-i18next';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 24, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

export default function TabLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { backgroundColor: colors.bgCard, borderTopColor: colors.border, borderTopWidth: 1, height: 60, paddingBottom: 8, paddingTop: 8 }, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textMuted, tabBarLabelStyle: { fontSize: 11, fontWeight: '600' } }}>
      <Tabs.Screen name="index" options={{ title: t('home.title'), tabBarIcon: ({ focused }) => <TabIcon emoji="⚖️" focused={focused} /> }} />
      <Tabs.Screen name="league" options={{ title: t('league.title'), tabBarIcon: ({ focused }) => <TabIcon emoji="🏆" focused={focused} /> }} />
      <Tabs.Screen name="guild" options={{ title: t('guild.title'), tabBarIcon: ({ focused }) => <TabIcon emoji="🏰" focused={focused} /> }} />
      <Tabs.Screen name="challenges" options={{ title: t('challenges.title'), tabBarIcon: ({ focused }) => <TabIcon emoji="⚔️" focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: t('profile.title'), tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} /> }} />
    </Tabs>
  );
}
