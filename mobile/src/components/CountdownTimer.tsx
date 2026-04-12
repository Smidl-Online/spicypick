import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from 'react-i18next';

// Countdown targets UTC midnight — matches server-side cron that publishes new scenarios at 00:00 UTC
function getTimeUntilMidnightUTC(): { hours: number; minutes: number; seconds: number; totalMs: number } {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0,
  ));
  const diff = tomorrow.getTime() - now.getTime();
  return {
    hours: Math.floor(diff / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
    totalMs: diff,
  };
}

function TimeSegment({ value, label }: { value: number; label: string }) {
  const { colors } = useTheme();
  const displayValue = String(value).padStart(2, '0');

  return (
    <View style={styles.segment}>
      <View style={[styles.segmentBox, { backgroundColor: colors.bgLight, borderColor: colors.border }]}>
        <Text style={[styles.segmentValue, { color: colors.primary }]}>{displayValue}</Text>
      </View>
      <Text style={[styles.segmentLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function Separator() {
  const { colors } = useTheme();
  return <Text style={[styles.separator, { color: colors.primary }]}>:</Text>;
}

export function CountdownTimer() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [time, setTime] = useState(getTimeUntilMidnightUTC);

  // Progress bar: percentage of day elapsed
  const progress = useSharedValue(0);

  const updateTime = useCallback(() => {
    const newTime = getTimeUntilMidnightUTC();
    setTime(newTime);
    // Calculate how much of the day has passed (24h = 86400000ms)
    const dayMs = 24 * 60 * 60 * 1000;
    const elapsed = dayMs - newTime.totalMs;
    progress.value = withTiming((elapsed / dayMs) * 100, { duration: 900 });
  }, [progress]);

  useEffect(() => {
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [updateTime]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
  }));

  return (
    <Animated.View entering={FadeIn.duration(600)} style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        ⏳ {t('home.next_scenario')}
      </Text>

      <View style={styles.timerRow}>
        <TimeSegment value={time.hours} label={t('common.hours')} />
        <Separator />
        <TimeSegment value={time.minutes} label={t('common.minutes')} />
        <Separator />
        <TimeSegment value={time.seconds} label={t('common.seconds')} />
      </View>

      {/* Day progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <Animated.View style={[styles.progressFill, { backgroundColor: colors.primary }, progressStyle]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 24,
    marginVertical: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  segment: {
    alignItems: 'center',
  },
  segmentBox: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    minWidth: 56,
    alignItems: 'center',
  },
  segmentValue: {
    fontSize: 28,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  segmentLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  separator: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    width: '80%',
    overflow: 'hidden',
    marginTop: 16,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});
