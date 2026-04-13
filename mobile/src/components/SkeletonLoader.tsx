import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';

type SkeletonProps = {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
  bgColor?: string;
};

function SkeletonBlock({ width = '100%', height = 16, borderRadius = 8, style, bgColor }: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: bgColor || colors.bgLight,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function ScenarioSkeleton() {
  const { colors } = useTheme();
  const cardStyle = useMemo(() => ({
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  }), [colors]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <SkeletonBlock width={150} height={28} />
        <SkeletonBlock width={80} height={28} borderRadius={14} />
      </View>

      {/* Scenario card */}
      <View style={cardStyle}>
        <SkeletonBlock width={80} height={12} style={{ marginBottom: 12 }} />
        <SkeletonBlock width="70%" height={22} style={{ marginBottom: 16 }} />
        <SkeletonBlock width="100%" height={14} style={{ marginBottom: 8 }} />
        <SkeletonBlock width="100%" height={14} style={{ marginBottom: 8 }} />
        <SkeletonBlock width="90%" height={14} style={{ marginBottom: 8 }} />
        <SkeletonBlock width="60%" height={14} />
      </View>

      {/* Verdict buttons */}
      <SkeletonBlock width="100%" height={56} borderRadius={16} style={{ marginBottom: 12 }} />
      <SkeletonBlock width="100%" height={56} borderRadius={16} style={{ marginBottom: 12 }} />
      <SkeletonBlock width="100%" height={56} borderRadius={16} style={{ marginBottom: 12 }} />
      <SkeletonBlock width="100%" height={56} borderRadius={16} />
    </View>
  );
}

export function LeagueSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      {/* Tier badge */}
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <SkeletonBlock width={120} height={120} borderRadius={60} />
        <SkeletonBlock width={100} height={20} style={{ marginTop: 12 }} />
      </View>

      {/* Leaderboard rows */}
      {Array.from({ length: 8 }).map((_, i) => (
        <View key={i} style={[styles.leaderboardRow, { borderBottomColor: colors.border }]}>
          <SkeletonBlock width={24} height={16} />
          <SkeletonBlock width={32} height={32} borderRadius={16} style={{ marginLeft: 12 }} />
          <SkeletonBlock width={120} height={16} style={{ marginLeft: 12 }} />
          <View style={{ flex: 1 }} />
          <SkeletonBlock width={50} height={16} />
        </View>
      ))}
    </View>
  );
}

export function ProfileSkeleton() {
  return (
    <View style={styles.container}>
      {/* Avatar + name */}
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <SkeletonBlock width={80} height={80} borderRadius={40} />
        <SkeletonBlock width={140} height={20} style={{ marginTop: 12 }} />
        <SkeletonBlock width={80} height={14} style={{ marginTop: 8 }} />
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={{ alignItems: 'center' }}>
          <SkeletonBlock width={50} height={24} />
          <SkeletonBlock width={40} height={12} style={{ marginTop: 4 }} />
        </View>
        <View style={{ alignItems: 'center' }}>
          <SkeletonBlock width={50} height={24} />
          <SkeletonBlock width={40} height={12} style={{ marginTop: 4 }} />
        </View>
        <View style={{ alignItems: 'center' }}>
          <SkeletonBlock width={50} height={24} />
          <SkeletonBlock width={40} height={12} style={{ marginTop: 4 }} />
        </View>
      </View>

      {/* XP bar */}
      <SkeletonBlock width="100%" height={8} borderRadius={4} style={{ marginVertical: 16 }} />

      {/* Achievements */}
      <SkeletonBlock width={120} height={18} style={{ marginBottom: 12 }} />
      <View style={styles.achievementsGrid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBlock key={i} width={56} height={56} borderRadius={12} />
        ))}
      </View>
    </View>
  );
}

export function ChallengesSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} style={[styles.challengeRow, { borderBottomColor: colors.border }]}>
          <SkeletonBlock width={40} height={40} borderRadius={20} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <SkeletonBlock width="60%" height={16} style={{ marginBottom: 6 }} />
            <SkeletonBlock width="40%" height={12} />
          </View>
          <SkeletonBlock width={80} height={32} borderRadius={16} />
        </View>
      ))}
    </View>
  );
}

export function GuildSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      {/* My guild card */}
      <View style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
        <SkeletonBlock width={140} height={20} style={{ marginBottom: 12 }} />
        <SkeletonBlock width="60%" height={14} style={{ marginBottom: 8 }} />
        <SkeletonBlock width={100} height={14} />
      </View>

      {/* Guild list */}
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={[styles.leaderboardRow, { borderBottomColor: colors.border }]}>
          <SkeletonBlock width={28} height={16} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <SkeletonBlock width="50%" height={16} style={{ marginBottom: 4 }} />
            <SkeletonBlock width="30%" height={12} />
          </View>
          <SkeletonBlock width={60} height={16} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  challengeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
});
