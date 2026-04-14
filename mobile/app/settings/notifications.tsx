import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Switch, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../../src/theme/ThemeContext';
import { api } from '../../src/api/client';

type NotifPrefs = {
  daily: boolean;
  streak: boolean;
  league: boolean;
  challenges: boolean;
  achievements: boolean;
};

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<NotifPrefs>('/api/users/me/notification-preferences')
      .then(setPrefs)
      .catch(() => {
        // Fallback to all enabled if endpoint fails
        setPrefs({ daily: true, streak: true, league: true, challenges: true, achievements: true });
      })
      .finally(() => setLoading(false));
  }, []);

  const toggle = useCallback((key: keyof NotifPrefs) => {
    if (!prefs) return;
    const newValue = !prefs[key];
    setPrefs({ ...prefs, [key]: newValue });
    api('/api/users/me/notification-preferences', {
      method: 'PATCH',
      body: { [key]: newValue },
    }).catch(() => {
      // Revert on failure
      setPrefs((prev) => prev ? { ...prev, [key]: !newValue } : prev);
    });
  }, [prefs]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (!prefs) return null;

  const rows: Array<{ key: keyof NotifPrefs; label: string; emoji: string }> = [
    { key: 'daily', label: 'Daily scenario (9:00)', emoji: '\u2696\uFE0F' },
    { key: 'streak', label: 'Streak warning (20:00)', emoji: '\uD83D\uDD25' },
    { key: 'league', label: 'League updates (Monday)', emoji: '\uD83C\uDFC6' },
    { key: 'challenges', label: 'Friend challenges', emoji: '\u2694\uFE0F' },
    { key: 'achievements', label: 'Achievements', emoji: '\uD83C\uDF96\uFE0F' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {rows.map((row) => (
        <View key={row.key} style={[styles.row, { borderBottomColor: colors.border }]}>
          <Text style={styles.emoji}>{row.emoji}</Text>
          <Text style={[styles.label, { color: colors.text }]}>{row.label}</Text>
          <Switch
            value={prefs[row.key]}
            onValueChange={() => toggle(row.key)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  emoji: { fontSize: 20, marginRight: 12 },
  label: { fontSize: 15, flex: 1 },
});
