import React, { useState } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { colors } from '../../src/theme/colors';

export default function NotificationsScreen() {
  const [dailyScenario, setDailyScenario] = useState(true);
  const [streakWarning, setStreakWarning] = useState(true);
  const [leagueUpdate, setLeagueUpdate] = useState(true);
  const [challenges, setChallenges] = useState(true);
  const [achievements, setAchievements] = useState(true);

  return (
    <View style={styles.container}>
      <NotifRow label="Daily scenario (9:00)" emoji="⚖️" value={dailyScenario} onChange={setDailyScenario} />
      <NotifRow label="Streak warning (20:00)" emoji="🔥" value={streakWarning} onChange={setStreakWarning} />
      <NotifRow label="League updates (Monday)" emoji="🏆" value={leagueUpdate} onChange={setLeagueUpdate} />
      <NotifRow label="Friend challenges" emoji="⚔️" value={challenges} onChange={setChallenges} />
      <NotifRow label="Achievements" emoji="🎖️" value={achievements} onChange={setAchievements} />
    </View>
  );
}

function NotifRow({ label, emoji, value, onChange }: { label: string; emoji: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.label}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  emoji: { fontSize: 20, marginRight: 12 },
  label: { fontSize: 15, color: colors.text, flex: 1 },
});
