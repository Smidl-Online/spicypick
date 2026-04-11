import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { colors } from '../../src/theme/colors';
import { useTranslation } from 'react-i18next';

type PremiumStatus = {
  isPremium: boolean;
  premiumUntil: string | null;
  features: string[];
};

const FEATURES = [
  { emoji: '📅', text: '3 scenarios per day' },
  { emoji: '📚', text: 'Full scenario archive' },
  { emoji: '🧠', text: 'Extended expert analysis' },
  { emoji: '🚫', text: 'Ad-free experience' },
  { emoji: '❄️', text: '3 streak freezes per month' },
];

export default function PremiumScreen() {
  const { t } = useTranslation();
  const { fetchProfile } = useAuthStore();
  const [status, setStatus] = useState<PremiumStatus | null>(null);

  useEffect(() => {
    api<PremiumStatus>('/api/premium/status')
      .then(setStatus)
      .catch(() => {});
  }, []);

  const handleSubscribe = async () => {
    try {
      // In production, this would trigger RevenueCat purchase flow
      await api('/api/premium/subscribe', {
        method: 'POST',
        body: { receipt: 'dev-receipt', platform: 'ios' },
      });
      await fetchProfile();
      Alert.alert('Premium activated!', 'Enjoy all premium features.');
      const updatedStatus = await api<PremiumStatus>('/api/premium/status');
      setStatus(updatedStatus);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.crown}>👑</Text>
        <Text style={styles.title}>{t('premium.title')}</Text>
        <Text style={styles.price}>$2.99/month</Text>
      </View>

      <View style={styles.features}>
        {FEATURES.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <Text style={styles.featureEmoji}>{f.emoji}</Text>
            <Text style={styles.featureText}>{f.text}</Text>
          </View>
        ))}
      </View>

      {status?.isPremium ? (
        <View style={styles.activeBox}>
          <Text style={styles.activeText}>
            ✅ Premium active until {status.premiumUntil?.split('T')[0]}
          </Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.subscribeBtn} onPress={handleSubscribe}>
          <Text style={styles.subscribeBtnText}>{t('premium.subscribe')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  header: { alignItems: 'center', marginVertical: 32 },
  crown: { fontSize: 64 },
  title: { fontSize: 24, fontWeight: '800', color: colors.accent, marginTop: 12 },
  price: { fontSize: 18, color: colors.text, marginTop: 8 },
  features: { marginVertical: 24 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  featureEmoji: { fontSize: 24, marginRight: 16 },
  featureText: { fontSize: 16, color: colors.text },
  activeBox: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.success,
  },
  activeText: { fontSize: 16, color: colors.success, fontWeight: '600' },
  subscribeBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  subscribeBtnText: { fontSize: 18, fontWeight: '800', color: '#fff' },
});
