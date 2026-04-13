import React, { useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useGuildStore } from '../../src/store/guildStore';
import { useTheme } from '../../src/theme/ThemeContext';
import { useTranslation } from 'react-i18next';
import { GuildSkeleton } from '../../src/components/SkeletonLoader';

const ROLE_EMOJI: Record<string, string> = {
  leader: '\u{1F451}',
  officer: '\u{1F6E1}\uFE0F',
  member: '\u{1F464}',
};

export default function GuildScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const {
    guilds, isLoadingGuilds, fetchGuilds,
    myGuild, myRole, isLoadingMyGuild, fetchMyGuild,
  } = useGuildStore();

  useEffect(() => {
    fetchMyGuild();
    fetchGuilds();
  }, []);

  const onRefresh = useCallback(() => {
    fetchMyGuild();
    fetchGuilds();
  }, []);

  const isLoading = isLoadingGuilds && isLoadingMyGuild;

  if (isLoading && guilds.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <GuildSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <FlatList
        data={guilds}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isLoadingGuilds} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        ListHeaderComponent={() => (
          <View>
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>{t('guild.title')}</Text>
              {!myGuild && (
                <TouchableOpacity
                  style={[styles.createBtn, { backgroundColor: colors.primary }]}
                  onPress={() => router.push('/guild/create')}
                >
                  <Text style={styles.createBtnText}>+ {t('guild.create')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* My Guild Card */}
            {myGuild ? (
              <TouchableOpacity
                style={[styles.myGuildCard, { backgroundColor: colors.bgCard, borderColor: colors.primary }]}
                onPress={() => router.push('/guild/my-guild')}
                activeOpacity={0.7}
              >
                <View style={styles.myGuildHeader}>
                  <Text style={[styles.myGuildLabel, { color: colors.textSecondary }]}>{t('guild.my_guild')}</Text>
                  <Text style={[styles.roleTag, { color: colors.primary }]}>
                    {ROLE_EMOJI[myRole || 'member']} {t(`guild.role_${myRole || 'member'}`)}
                  </Text>
                </View>
                <Text style={[styles.myGuildName, { color: colors.text }]}>{myGuild.name}</Text>
                <View style={styles.myGuildStats}>
                  <Text style={[styles.myGuildStat, { color: colors.xp }]}>
                    {t('guild.weekly_xp', { xp: myGuild.weeklyXp })}
                  </Text>
                  <Text style={[styles.myGuildStat, { color: colors.textSecondary }]}>
                    {t('guild.members_count', { count: myGuild.memberCount, max: myGuild.maxMembers })}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={[styles.noGuildCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>{'\u{1F3F0}'}</Text>
                <Text style={[styles.noGuildText, { color: colors.text }]}>{t('guild.no_guild')}</Text>
                <Text style={[styles.noGuildHint, { color: colors.textSecondary }]}>{t('guild.no_guild_hint')}</Text>
              </View>
            )}

            {/* Leaderboard header */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('guild.leaderboard')}</Text>
          </View>
        )}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[styles.guildRow, { backgroundColor: colors.bgCard }]}
            onPress={() => router.push(`/guild/${item.id}`)}
            activeOpacity={0.7}
          >
            <Text style={[styles.guildRank, { color: colors.textSecondary }]}>#{index + 1}</Text>
            <View style={styles.guildInfo}>
              <Text style={[styles.guildName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.guildMeta, { color: colors.textSecondary }]}>
                {t('guild.members_count', { count: item.memberCount, max: item.maxMembers })}
              </Text>
            </View>
            <Text style={[styles.guildXp, { color: colors.xp }]}>{item.weeklyXp} XP</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('guild.no_guilds')}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  title: { fontSize: 24, fontWeight: '800' },
  createBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  myGuildCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
  },
  myGuildHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  myGuildLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  roleTag: { fontSize: 12, fontWeight: '700' },
  myGuildName: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  myGuildStats: { flexDirection: 'row', justifyContent: 'space-between' },
  myGuildStat: { fontSize: 13, fontWeight: '600' },
  noGuildCard: {
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
  },
  noGuildText: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  noGuildHint: { fontSize: 13, textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  guildRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    marginVertical: 3,
  },
  guildRank: { fontSize: 14, fontWeight: '700', width: 36 },
  guildInfo: { flex: 1 },
  guildName: { fontSize: 15, fontWeight: '600' },
  guildMeta: { fontSize: 12, marginTop: 2 },
  guildXp: { fontSize: 14, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 15 },
});
