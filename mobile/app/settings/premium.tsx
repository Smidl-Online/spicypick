import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { useTheme } from '../../src/theme/ThemeContext';
import { useTranslation } from 'react-i18next';
import { analytics } from '../../src/services/analytics';

type PremiumStatus = { isPremium: boolean; premiumUntil: string | null; features: string[] };
const FEATURE_EMOJIS = ['📅', '📚', '🎭', '🧠', '🚫', '❄️'];

export default function PremiumScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { fetchProfile } = useAuthStore();
  const [status, setStatus] = useState<PremiumStatus | null>(null);
  const features = t('premium.features', { returnObjects: true }) as string[];
  useEffect(() => { api<PremiumStatus>('/api/premium/status').then(setStatus).catch(() => {}); }, []);
  const handleSubscribe = async () => {
    try {
      await api('/api/premium/subscribe', { method: 'POST', body: { receipt: 'dev-receipt', platform: 'ios' } });
      await fetchProfile(); analytics.track('premium_subscribe', { platform: 'ios' });
      Alert.alert(t('premium.activated_title', 'Premium activated!'), t('premium.activated_msg', 'Enjoy all premium features.'));
      setStatus(await api<PremiumStatus>('/api/premium/status'));
    } catch (err: any) { Alert.alert(t('common.error'), err.message); }
  };
  return (<View style={[styles.container, { backgroundColor: colors.bg }]}><View style={styles.header}><Text style={styles.crown}>👑</Text><Text style={[styles.title, { color: colors.accent }]}>{t('premium.title')}</Text><Text style={[styles.price, { color: colors.text }]}>{t('premium.price')}</Text></View><View style={styles.features}>{features.map((text, i) => (<View key={i} style={styles.featureRow}><Text style={styles.featureEmoji}>{FEATURE_EMOJIS[i] || '✨'}</Text><Text style={[styles.featureText, { color: colors.text }]}>{text}</Text></View>))}</View>{status?.isPremium ? (<View style={[styles.activeBox, { backgroundColor: colors.bgCard, borderColor: colors.success }]}><Text style={[styles.activeText, { color: colors.success }]}>✅ {t('premium.active', { date: status.premiumUntil?.split('T')[0] })}</Text></View>) : (<TouchableOpacity style={[styles.subscribeBtn, { backgroundColor: colors.accent }]} onPress={handleSubscribe}><Text style={styles.subscribeBtnText}>{t('premium.subscribe')}</Text></TouchableOpacity>)}</View>);
}
const styles = StyleSheet.create({ container: { flex: 1, padding: 20 }, header: { alignItems: 'center', marginVertical: 32 }, crown: { fontSize: 64 }, title: { fontSize: 24, fontWeight: '800', marginTop: 12 }, price: { fontSize: 18, marginTop: 8 }, features: { marginVertical: 24 }, featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 }, featureEmoji: { fontSize: 24, marginRight: 16 }, featureText: { fontSize: 16 }, activeBox: { borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1 }, activeText: { fontSize: 16, fontWeight: '600' }, subscribeBtn: { paddingVertical: 18, borderRadius: 14, alignItems: 'center', marginTop: 16 }, subscribeBtnText: { fontSize: 18, fontWeight: '800', color: '#fff' } });
