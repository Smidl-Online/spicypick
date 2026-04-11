import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors } from '../theme/colors';

type Stats = {
  total: number;
  guilty: number;
  notGuilty: number;
  complicated: number;
  bothWrong: number;
};

type Props = {
  stats: Stats;
  userVerdict: string | null;
};

const VERDICTS = [
  { key: 'guilty', label: 'Guilty', emoji: '❌', color: colors.guilty, field: 'guilty' as const },
  { key: 'not_guilty', label: 'Not Guilty', emoji: '✅', color: colors.notGuilty, field: 'notGuilty' as const },
  { key: 'complicated', label: "Complicated", emoji: '🤔', color: colors.complicated, field: 'complicated' as const },
  { key: 'both_wrong', label: 'Both Wrong', emoji: '⚡', color: colors.bothWrong, field: 'bothWrong' as const },
];

export function CommunityStats({ stats, userVerdict }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>👥 Community voted</Text>
      <Text style={styles.totalVotes}>{stats.total} votes</Text>

      {VERDICTS.map((v, idx) => {
        const count = stats[v.field];
        const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
        const isUser = userVerdict === v.key;

        return (
          <Animated.View
            key={v.key}
            entering={FadeInDown.delay(idx * 150).duration(400)}
            style={styles.row}
          >
            <View style={styles.labelRow}>
              <Text style={styles.emoji}>{v.emoji}</Text>
              <Text style={[styles.label, isUser && { color: v.color, fontWeight: '700' }]}>
                {v.label} {isUser ? '← You' : ''}
              </Text>
              <Text style={[styles.pct, { color: v.color }]}>{pct}%</Text>
            </View>
            <View style={styles.barBg}>
              <Animated.View
                style={[styles.barFill, { width: `${pct}%`, backgroundColor: v.color }]}
              />
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 16 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
  totalVotes: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },
  row: { marginBottom: 12 },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  emoji: { fontSize: 16, marginRight: 8 },
  label: { fontSize: 14, color: colors.text, flex: 1 },
  pct: { fontSize: 16, fontWeight: '700' },
  barBg: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
});
