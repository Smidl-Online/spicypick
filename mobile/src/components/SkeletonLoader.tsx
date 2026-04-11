import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';

type SkeletonProps = {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
};

function SkeletonBlock({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
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
          backgroundColor: colors.bgLight,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function ScenarioSkeleton() {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <SkeletonBlock width={150} height={28} />
        <SkeletonBlock width={80} height={28} borderRadius={14} />
      </View>

      {/* Scenario card */}
      <View style={styles.card}>
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
  return (
    <View style={styles.container}>
      {/* Tier badge */}
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <SkeletonBlock width={120} height={120} borderRadius={60} />
        <SkeletonBlock width={100} height={20} style={{ marginTop: 12 }} />
      </View>

      {/* Leaderboard rows */}
      {Array.from({ length: 8 }).map((_, i) => (
        <View key={i} style={styles.leaderboardRow}>
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
  return (
    <View style={styles.container}>
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} style={styles.challengeRow}>
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

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  challengeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
