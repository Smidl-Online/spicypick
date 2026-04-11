import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { useTranslation } from 'react-i18next';

export function CountdownTimer() {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const diff = tomorrow.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(
        `${hours}${t('common.hours')} ${minutes}${t('common.minutes')} ${seconds}${t('common.seconds')}`,
      );
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [t]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('home.next_scenario')}</Text>
      <Text style={styles.timer}>{timeLeft}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 24 },
  label: { fontSize: 14, color: colors.textSecondary, marginBottom: 8 },
  timer: { fontSize: 32, fontWeight: '800', color: colors.primary },
});
