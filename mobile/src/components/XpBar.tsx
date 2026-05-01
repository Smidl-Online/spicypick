import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  xp: number;
  level: number;
  testID?: string;
};

function xpForLevel(level: number): number {
  return Math.floor(50 * Math.pow(level, 1.5));
}

export function XpBar({ xp, level, testID }: Props) {
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const progress = nextLevelXp > currentLevelXp
    ? (xp - currentLevelXp) / (nextLevelXp - currentLevelXp)
    : 0;

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.header}>
        <Text style={styles.level}>Level {level}</Text>
        <Text style={styles.xp}>{xp} / {nextLevelXp} XP</Text>
      </View>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${Math.min(progress * 100, 100)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  level: { fontSize: 14, fontWeight: '700', color: colors.xp },
  xp: { fontSize: 12, color: colors.textSecondary },
  barBg: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3, backgroundColor: colors.xp },
});
