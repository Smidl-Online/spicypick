import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { colors } from '../../src/theme/colors';
import { useTranslation } from 'react-i18next';
import { analytics } from '../../src/services/analytics';
import { purchasePremium, restorePurchases, checkPremiumStatus, checkRevenueCatConfigured } from '../../src/services/revenueCat';

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
  const { fetchProfile, user } = useAuthStore();
  const [status, setStatus] = useState<PremiumStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [rcConfigured, setRcConfigured] = useState(false);

  useEffect(() => {
    api<PremiumStatus>('/api/premium/status')
      .then(setStatus)
      .catch(() => {});
    checkRevenueCatConfigured().then(setRcConfigured);
  }, []);

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      const result = await purchasePremium(user?.id);
      if (!result) {
        setIsLoading(false);
        return;
      }

      // Always POST to /subscribe — backend verifies via RC status check
      // with retry + receipt validation fallback for RC purchases,
      // or auto-activates in dev mode when SDK not configured
      await api('/api/premium/subscribe', {
        method: 'POST',
        body: { platform: result.platform },
      });

      await fetchProfile();
      analytics.track('premium_subscribe', { platform: result.platform });
      Alert.alert(t('premium.activated_title', 'Premium activated!'), t('premium.activated_msg', 'Enjoy all premium features.'));
      const updatedStatus = await api<PremiumStatus>('/api/premium/status');
      setStatus(updatedStatus);
    } catch (err: any) {
      // User cancelled purchase — not an error
      if (err?.userCancelled || err?.code === '1') return;
      Alert.alert(t('common.error', 'Error'), err.message);
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
        // Sync with backend via status endpoint — RevenueCat already validated the restore
        const updatedStatus = await api<PremiumStatus>('/api/premium/status');
        setStatus(updatedStatus);
        await fetchProfile();
        Alert.alert(t('premium.restored_title', 'Restored!'), t('premium.restored_msg', 'Your premium subscription has been restored.'));
      } else {
        Alert.alert(t('premium.no_purchase_title', 'No purchase found'), t('premium.no_purchase_msg', 'No active subscription found to restore.'));
      }
    } catch (err: any) {
      Alert.alert(t('common.error', 'Error'), err.message);
    } finally {
      setIsRestoring(false);
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
        <View>
          <TouchableOpacity
            style={[styles.subscribeBtn, isLoading && styles.btnDisabled]}
            onPress={handleSubscribe}
            disabled={isLoading || isRestoring}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.subscribeBtnText}>{t('premium.subscribe')}</Text>
            )}
          </TouchableOpacity>

          {rcConfigured && (
            <TouchableOpacity
              style={styles.restoreBtn}
              onPress={handleRestore}
              disabled={isLoading || isRestoring}
            >
              {isRestoring ? (
                <ActivityIndicator color={colors.textSecondary} />
              ) : (
                <Text style={styles.restoreBtnText}>{t('premium.restore', 'Restore purchases')}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
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
  btnDisabled: { opacity: 0.6 },
  subscribeBtnText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  restoreBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  restoreBtnText: { fontSize: 14, color: colors.textSecondary, textDecorationLine: 'underline' },
});
