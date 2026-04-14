import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { VerdictButton } from './VerdictButton';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from 'react-i18next';

const VERDICTS = ['guilty', 'not_guilty', 'complicated', 'both_wrong'] as const;

type Props = {
  onPredict: (verdict: string) => Promise<void>;
  onSkip: () => void;
};

export function PredictionStep({ onPredict, onSkip }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [submitting, setSubmitting] = useState(false);

  const handlePredict = async (verdict: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onPredict(verdict);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Animated.View entering={FadeInUp.duration(500)}>
      <View style={[styles.container, { backgroundColor: colors.bgCard, borderColor: colors.accent }]}>
        <Text style={[styles.icon]}>🔮</Text>
        <Text style={[styles.title, { color: colors.accent }]}>{t('prediction.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('prediction.subtitle')}</Text>
      </View>

      {VERDICTS.map((v) => (
        <VerdictButton
          key={v}
          verdict={v}
          onPress={() => handlePredict(v)}
          disabled={submitting}
        />
      ))}

      <TouchableOpacity style={styles.skipButton} onPress={onSkip} disabled={submitting}>
        <Text style={[styles.skipText, { color: colors.textMuted }]}>{t('prediction.skip')}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  icon: { fontSize: 36, marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 4 },
  skipButton: { alignItems: 'center', paddingVertical: 12 },
  skipText: { fontSize: 14, fontWeight: '500' },
});
