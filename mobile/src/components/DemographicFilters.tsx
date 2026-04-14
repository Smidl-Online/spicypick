import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import { api, ApiError } from '../api/client';
import { useAuthStore } from '../store/authStore';

type DemographicGroup = {
  value: string;
  total: number;
  guilty: number;
  notGuilty: number;
  complicated: number;
  bothWrong: number;
};

type DemographicResponse = {
  type: string;
  groups: DemographicGroup[];
};

type TabKey = 'all' | 'age_group' | 'country' | 'gender';

const TABS: TabKey[] = ['all', 'age_group', 'country', 'gender'];

type Props = {
  scenarioId: string;
  isPremium: boolean;
  onPremiumCta?: () => void;
};

export function DemographicFilters({ scenarioId, isPremium, onPremiumCta }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [data, setData] = useState<Record<string, DemographicGroup[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tabLabels: Record<TabKey, string> = {
    all: t('demographics.tabs.all'),
    age_group: t('demographics.tabs.age'),
    country: t('demographics.tabs.country'),
    gender: t('demographics.tabs.gender'),
  };

  const fetchDemographics = useCallback(async (type: TabKey) => {
    if (type === 'all') return;
    if (data[type]) return; // cached

    setLoading(true);
    setError(null);
    try {
      const res = await api<DemographicResponse>(`/api/scenarios/${scenarioId}/demographics?type=${type}`);
      setData(prev => ({ ...prev, [type]: res.groups }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        if (err.body?.code === 'vote_required') {
          setError(t('demographics.voteRequired'));
        } else {
          setError(t('demographics.premium.required'));
        }
      } else {
        setError(t('common.error'));
      }
    } finally {
      setLoading(false);
    }
  }, [scenarioId, data, t]);

  const handleTabPress = (tab: TabKey) => {
    if (!isPremium && tab !== 'all') {
      onPremiumCta?.();
      return;
    }
    setActiveTab(tab);
    fetchDemographics(tab);
  };

  const groups = activeTab === 'all' ? null : data[activeTab];

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>{t('demographics.title')}</Text>

      <View style={styles.tabRow}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => handleTabPress(tab)}
            style={[
              styles.tab,
              { borderColor: colors.border },
              activeTab === tab && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
          >
            <Text style={[
              styles.tabText,
              { color: colors.textSecondary },
              activeTab === tab && { color: colors.text, fontWeight: '700' },
            ]}>
              {tabLabels[tab]}
            </Text>
            {!isPremium && tab !== 'all' && (
              <Text style={styles.lockIcon}>🔒</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'all' && (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {isPremium ? t('demographics.selectFilter') : t('demographics.premium.cta')}
        </Text>
      )}

      {loading && <ActivityIndicator color={colors.primary} style={styles.loader} />}
      {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}

      {groups && groups.length === 0 && !loading && (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('demographics.noData')}</Text>
      )}

      {groups && groups.map((group, idx) => (
        <Animated.View
          key={group.value}
          entering={FadeInDown.delay(idx * 100).duration(300)}
          style={[styles.groupCard, { backgroundColor: colors.bgCard }]}
        >
          <Text style={[styles.groupLabel, { color: colors.text }]}>
            {formatGroupLabel(activeTab, group.value, t)}
          </Text>
          <Text style={[styles.groupVotes, { color: colors.textSecondary }]}>
            {group.total} {t('packs.votes')}
          </Text>
          <View style={styles.barsContainer}>
            {renderBar('guilty', group.guilty, group.total, colors.guilty)}
            {renderBar('not_guilty', group.notGuilty, group.total, colors.notGuilty)}
            {renderBar('complicated', group.complicated, group.total, colors.complicated)}
            {renderBar('both_wrong', group.bothWrong, group.total, colors.bothWrong)}
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

function renderBar(key: string, count: number, total: number, color: string) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View key={key} style={styles.barRow}>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.barPct, { color }]}>{pct}%</Text>
    </View>
  );
}

function formatGroupLabel(type: TabKey, value: string, t: (key: string) => string): string {
  if (type === 'age_group') {
    return t(`demographics.ageGroups.${value.replace('+', 'plus')}`);
  }
  if (type === 'gender') {
    return t(`demographics.genders.${value}`);
  }
  // country — just return the code, i18n country names handled by the locale
  return value;
}

const styles = StyleSheet.create({
  container: { marginVertical: 16 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabText: { fontSize: 13 },
  lockIcon: { fontSize: 10 },
  hint: { fontSize: 14, textAlign: 'center', marginVertical: 12 },
  loader: { marginVertical: 16 },
  error: { fontSize: 14, textAlign: 'center', marginVertical: 12 },
  groupCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  groupLabel: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  groupVotes: { fontSize: 12, marginBottom: 8 },
  barsContainer: { gap: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  barPct: { fontSize: 11, fontWeight: '700', width: 32, textAlign: 'right' },
});
