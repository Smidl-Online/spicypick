import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInUp, BounceIn } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from 'react-i18next';

type Props = {
  isCorrect: boolean;
  xpEarned: number;
  predictedVerdict: string;
};

export function PredictionResult({ isCorrect, xpEarned, predictedVerdict }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Animated.View
      entering={FadeInUp.delay(400).duration(500)}
      style={[
        styles.container,
        {
          backgroundColor: colors.bgCard,
          borderColor: isCorrect ? colors.success : colors.error,
        },
      ]}
    >
      <Animated.Text entering={BounceIn.delay(600)} style={styles.emoji}>
        {isCorrect ? '🎯' : '😅'}
      </Animated.Text>
      <Text style={[styles.text, { color: isCorrect ? colors.success : colors.textSecondary }]}>
        {isCorrect
          ? t('prediction.correct', { xp: xpEarned })
          : t('prediction.incorrect')}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emoji: { fontSize: 28 },
  text: { fontSize: 16, fontWeight: '700' },
});
