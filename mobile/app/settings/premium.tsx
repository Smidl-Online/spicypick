import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { useTheme } from '../../src/theme/ThemeContext';
import { useTranslation } from 'react-i18next';
import { analytics } from '../../src/services/analytics';
import { purchasePremium, restorePurchases, checkPremiumStatus } from '../../src/services/revenueCat';

type PremiumStatus = {
  isPremium: boolean;
  premiumUntil: string | null;
  features: string[];
};

const FEATURE_KEYS = [
  { emoji: '📅', key: 'premium.feature_scenarios' },
  { emoji: '📚', key: 'premium.feature_archive' },
  { emoji: '🧠', key: 'premium.feature_expert' },
  { emoji: '🚫', key: 'premium.feature_adfree' },
  { emoji: '❄️', key: 'premium.feature_freezes' },
];

export default function PremiumScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { fetchProfile, user } = useAuthStore();
  const [status, setStatus] = useState<PremiumStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    api<PremiumStatus>('/api/premium/status')
      .then(setStatus)
      .catch(() => {});
  }, []);

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      const result = await purchasePremium(user?.id);
      if (!result) {
        setIsLoading(false);
        return;
      }

      if (result.sdkConfigured) {
        await api<PremiumStatus>('/api/premium/status');
      } else {
        await api('/api/premium/subscribe', {
          method: 'POST',
          body: { platform: result.platform },
        });
      }

      await fetchProfile();
      analytics.track('premium_subscribe', { platform: result.platform });
      Alert.alert(t('premium.activated_title'), t('premium.activated_msg'));
      const updatedStatus = await api<PremiumStatus>('/api/premium/status');
      setStatus(updatedStatus);
    } catch (err: any) {
      if (err?.userCancelled || err?.code === '1') return;
      Alert.alert(t('common.error'), err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      await restorePurchases(user?.id);
      const isPremium = await checkPremiumStatus();

      if (isPremium) {
        const updatedStatus = await api<PremiumStatus>('/api/premium/status');
        setStatus(updatedStatus);
        await fetchProfile();
        Alert.alert(t('premium.restored_title'), t('premium.restored_msg'));
      } else {
        Alert.alert(t('premium.no_purchase_title'), t('premium.no_purchase_msg'));
      }
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Text style={styles.crown}>👑</Text>
        <Text style={[styles.title, { color: colors.accent }]}>{t('premium.title')}</Text>
        <Text style={[styles.price, { color: colors.text }]}>{t('premium.price')}</Text>
      </View>

      <View style={styles.features}>
        {FEATURE_KEYS.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <Text style={styles.featureEmoji}>{f.emoji}</Text>
            <Text style={[styles.featureText, { color: colors.text }]}>{t(f.key)}</Text>
          </View>
        ))}
      </View>

      {status?.isPremium ? (
        <View style={[styles.activeBox, { backgroundColor: colors.bgCard, borderColor: colors.success }]}>
          <Text style={[styles.activeText, { color: colors.success }]}>
            ✅ {t('premium.active_until', { date: status.premiumUntil?.split('T')[0] })}
          </Text>
        </View>
      ) : (
        <View>
          <TouchableOpacity
            style={[styles.subscribeBtn, { backgroundColor: colors.accent }, isLoading && styles.btnDisabled]}
            onPress={handleSubscribe}
            disabled={isLoading || isRestoring}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.subscribeBtnText}>{t('premium.subscribe')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={handleRestore}
            disabled={isLoading || isRestoring}
          >
            {isRestoring ? (
              <ActivityIndicator color={colors.textSecondary} />
            ) : (
              <Text style={[styles.restoreBtnText, { color: colors.textSecondary }]}>{t('premium.restore')}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { alignItems: 'center', marginVertical: 32 },
  crown: { fontSize: 64 },
  title: { fontSize: 24, fontWeight: '800', marginTop: 12 },
  price: { fontSize: 18, marginTop: 8 },
  features: { marginVertical: 24 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  featureEmoji: { fontSize: 24, marginRight: 16 },
  featureText: { fontSize: 16 },
  activeBox: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  activeText: { fontSize: 16, fontWeight: '600' },
  subscribeBtn: {
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  btnDisabled: { opacity: 0.6 },
  subscribeBtnText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  restoreBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  restoreBtnText: { fontSize: 14, textDecorationLine: 'underline' },
});
