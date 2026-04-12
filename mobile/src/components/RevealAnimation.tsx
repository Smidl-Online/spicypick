import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  Easing,
  FadeIn,
  FadeInUp,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Particle = {
  id: number;
  emoji: string;
  x: number;
  delay: number;
  rotation: number;
};

const CONFETTI_EMOJIS = ['🎉', '🌶️', '⚡', '✨', '🔥', '💥', '🎊'];
const PARTICLE_COUNT = 12;

function generateParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    emoji: CONFETTI_EMOJIS[i % CONFETTI_EMOJIS.length],
    x: Math.random() * SCREEN_WIDTH - SCREEN_WIDTH / 2,
    delay: Math.random() * 400,
    rotation: Math.random() * 360,
  }));
}

function ConfettiParticle({ particle }: { particle: Particle }) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      particle.delay,
      withSpring(1, { damping: 8, stiffness: 200 }),
    );
    translateY.value = withDelay(
      particle.delay,
      withTiming(-200 - Math.random() * 100, {
        duration: 1200,
        easing: Easing.out(Easing.quad),
      }),
    );
    translateX.value = withDelay(
      particle.delay,
      withTiming(particle.x * 0.6, {
        duration: 1200,
        easing: Easing.out(Easing.quad),
      }),
    );
    rotate.value = withDelay(
      particle.delay,
      withTiming(particle.rotation, { duration: 1200 }),
    );
    opacity.value = withDelay(
      particle.delay + 800,
      withTiming(0, { duration: 400 }),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.Text style={[styles.particle, animStyle]}>
      {particle.emoji}
    </Animated.Text>
  );
}

type Props = {
  majorityMatch: boolean;
  xpEarned: number;
  streak: number;
  newAchievements: string[];
};

export function RevealAnimation({ majorityMatch, xpEarned, streak, newAchievements }: Props) {
  const { colors } = useTheme();
  const particles = React.useMemo(() => generateParticles(), []);
  const progressWidth = useSharedValue(0);

  useEffect(() => {
    progressWidth.value = withDelay(
      300,
      withTiming(100, { duration: 1500, easing: Easing.out(Easing.cubic) }),
    );
  }, []);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  return (
    <View style={styles.container}>
      {/* Confetti burst */}
      <View style={styles.confettiContainer}>
        {particles.map((p) => (
          <ConfettiParticle key={p.id} particle={p} />
        ))}
      </View>

      {/* XP earned banner */}
      <Animated.View
        entering={FadeInUp.delay(200).springify().damping(12)}
        style={[styles.xpBanner, { backgroundColor: colors.bgLight, borderColor: colors.xp }]}
      >
        <Text style={[styles.xpText, { color: colors.xp }]}>+{xpEarned} XP</Text>
        {majorityMatch && (
          <Animated.Text
            entering={FadeIn.delay(600)}
            style={[styles.majorityText, { color: colors.xp }]}
          >
            🎯 Majority match!
          </Animated.Text>
        )}
      </Animated.View>

      {/* Streak update */}
      {streak > 1 && (
        <Animated.View
          entering={FadeInUp.delay(500).springify().damping(12)}
          style={[styles.streakBanner, { backgroundColor: colors.bgLight, borderColor: colors.streak }]}
        >
          <Text style={[styles.streakText, { color: colors.streak }]}>
            🔥 {streak} day streak!
          </Text>
        </Animated.View>
      )}

      {/* New achievements */}
      {newAchievements.length > 0 && (
        <Animated.View
          entering={FadeInUp.delay(800).springify().damping(12)}
          style={[styles.achievementBanner, { backgroundColor: colors.bgLight, borderColor: colors.accent }]}
        >
          <Text style={[styles.achievementTitle, { color: colors.accent }]}>🏆 Achievement unlocked!</Text>
          {newAchievements.map((a) => (
            <Text key={a} style={[styles.achievementName, { color: colors.text }]}>{a}</Text>
          ))}
        </Animated.View>
      )}

      {/* XP Progress bar */}
      <Animated.View
        entering={FadeIn.delay(300)}
        style={[styles.progressContainer, { backgroundColor: colors.border }]}
      >
        <Animated.View style={[styles.progressFill, { backgroundColor: colors.xp }, progressStyle]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 8,
  },
  confettiContainer: {
    position: 'absolute',
    top: 40,
    left: SCREEN_WIDTH / 2 - 20,
    width: 40,
    height: 40,
    zIndex: 10,
  },
  particle: {
    position: 'absolute',
    fontSize: 20,
  },
  xpBanner: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    marginBottom: 8,
  },
  xpText: {
    fontSize: 28,
    fontWeight: '800',
  },
  majorityText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  streakBanner: {
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    marginBottom: 8,
  },
  streakText: {
    fontSize: 18,
    fontWeight: '700',
  },
  achievementBanner: {
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    marginBottom: 8,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  achievementName: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressContainer: {
    height: 6,
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
});
