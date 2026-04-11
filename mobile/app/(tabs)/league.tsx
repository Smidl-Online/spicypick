import React, { useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLeagueStore } from '../../src/store/leagueStore';
import { colors } from '../../src/theme/colors';
import { useTranslation } from 'react-i18next';

const TIER_EMOJI: Record<string, string> = {
  bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💠',
  diamond: '💎', obsidian: '🖤', ruby: '❤️', emerald: '💚',
  sapphire: '💙', amethyst: '💜',
};

const TIER_COLOR: Record<string, string> = {
  bronze: colors.bronze, silver: colors.silver, gold: colors.gold,
  platinum: colors.platinum, diamond: colors.diamond, obsidian: colors.obsidian,
  ruby: colors.ruby, emerald: colors.emerald, sapphire: colors.sapphire,
  amethyst: colors.amethyst,
};

export default function LeagueScreen() {
  const { t } = useTranslation();
  const { league, userRank, leaderboard, isLoading, fetchCurrent } = useLeagueStore();

  useEffect(() => {
    fetchCurrent();
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  if (!league) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🏆</Text>
          <Text style={styles.emptyText}>{t('league.not_in_league')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const tierColor = TIER_COLOR[league.tier] || colors.text;

  return (
    <SafeAreaView style={styles.container}>
      {/* League header */}
      <View style={styles.header}>
        <Text style={styles.tierEmoji}>{TIER_EMOJI[league.tier] || '🏆'}</Text>
        <Text style={[styles.tierName, { color: tierColor }]}>
          {league.tier.charAt(0).toUpperCase() + league.tier.slice(1)} League
        </Text>
        <Text style={styles.rank}>{t('league.rank', { rank: userRank })}</Text>
      </View>

      {/* Leaderboard */}
      <FlatList
        data={leaderboard}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View
            style={[
              styles.row,
              item.isCurrentUser && styles.currentUserRow,
              item.isPromotionZone && styles.promotionRow,
              item.isDemotionZone && styles.demotionRow,
            ]}
          >
            <Text style={styles.rowRank}>#{item.rank}</Text>
            <View style={styles.rowInfo}>
              <Text style={[styles.rowName, item.isCurrentUser && { color: colors.primary, fontWeight: '700' }]}>
                {item.username} {item.isCurrentUser ? '(You)' : ''}
              </Text>
            </View>
            <Text style={styles.rowXp}>{item.weeklyXp} XP</Text>
          </View>
        )}
        ListHeaderComponent={() => (
          <View style={styles.zones}>
            <View style={styles.zoneIndicator}>
              <View style={[styles.zoneDot, { backgroundColor: colors.success }]} />
              <Text style={styles.zoneText}>{t('league.promotion_zone')}</Text>
            </View>
            <View style={styles.zoneIndicator}>
              <View style={[styles.zoneDot, { backgroundColor: colors.error }]} />
              <Text style={styles.zoneText}>{t('league.demotion_zone')}</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  tierEmoji: { fontSize: 48 },
  tierName: { fontSize: 24, fontWeight: '800', marginTop: 8 },
  rank: { fontSize: 16, color: colors.textSecondary, marginTop: 4 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 16, color: colors.textSecondary },
  zones: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  zoneIndicator: { flexDirection: 'row', alignItems: 'center' },
  zoneDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  zoneText: { fontSize: 12, color: colors.textSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    padding: 12,
    marginVertical: 3,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  currentUserRow: { borderLeftColor: colors.primary, backgroundColor: colors.bgLight },
  promotionRow: { borderLeftColor: colors.success },
  demotionRow: { borderLeftColor: colors.error },
  rowRank: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, width: 36 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 15, color: colors.text },
  rowXp: { fontSize: 14, fontWeight: '700', color: colors.xp },
});
