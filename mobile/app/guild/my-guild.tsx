import React, { useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useGuildStore } from '../../src/store/guildStore';
import { useTheme } from '../../src/theme/ThemeContext';
import { useTranslation } from 'react-i18next';

const ROLE_EMOJI: Record<string, string> = {
  leader: '\u{1F451}',
  officer: '\u{1F6E1}\uFE0F',
  member: '\u{1F464}',
};

export default function MyGuildScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const {
    myGuild, myRole, myGuildMembers,
    isLoadingMyGuild, fetchMyGuild,
    leaveGuild, isActing, error, clearError,
  } = useGuildStore();

  useEffect(() => {
    fetchMyGuild();
  }, []);

  useEffect(() => {
    if (error) {
      Alert.alert(t('common.error'), error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error]);

  const onRefresh = useCallback(() => {
    fetchMyGuild();
  }, []);

  const handleLeave = () => {
    if (!myGuild) return;
    Alert.alert(
      t('guild.leave'),
      t('guild.leave_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('guild.leave'),
          style: 'destructive',
          onPress: async () => {
            const success = await leaveGuild(myGuild.id);
            if (success) router.back();
          },
        },
      ],
    );
  };

  if (isLoadingMyGuild && !myGuild) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!myGuild) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { paddingHorizontal: 16 }]}>
          <Text style={[styles.backText, { color: colors.primary }]}>{'\u{2190}'} {t('common.cancel')}</Text>
        </TouchableOpacity>
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>{'\u{1F3F0}'}</Text>
          <Text style={[styles.emptyText, { color: colors.text }]}>{t('guild.no_guild')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <FlatList
        data={myGuildMembers}
        keyExtractor={(item) => item.userId}
        refreshControl={
          <RefreshControl refreshing={isLoadingMyGuild} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        ListHeaderComponent={() => (
          <View>
            {/* Back */}
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={[styles.backText, { color: colors.primary }]}>{'\u{2190}'} {t('common.cancel')}</Text>
            </TouchableOpacity>

            {/* Guild info card */}
            <View style={[styles.guildCard, { backgroundColor: colors.bgCard, borderColor: colors.primary }]}>
              <View style={styles.guildHeader}>
                <Text style={[styles.guildName, { color: colors.text }]}>{myGuild.name}</Text>
                <Text style={[styles.roleTag, { color: colors.primary }]}>
                  {ROLE_EMOJI[myRole || 'member']} {t(`guild.role_${myRole || 'member'}`)}
                </Text>
              </View>
              {myGuild.description && (
                <Text style={[styles.guildDesc, { color: colors.textSecondary }]}>{myGuild.description}</Text>
              )}
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.xp }]}>{myGuild.weeklyXp}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>XP/week</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.text }]}>{myGuild.totalXp}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total XP</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.text }]}>{myGuild.memberCount}/{myGuild.maxMembers}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('guild.members')}</Text>
                </View>
              </View>

              {/* Leave button (not for leader) */}
              {myRole !== 'leader' && (
                <TouchableOpacity
                  style={[styles.leaveBtn, { borderColor: colors.error }]}
                  onPress={handleLeave}
                  disabled={isActing}
                >
                  {isActing ? (
                    <ActivityIndicator color={colors.error} size="small" />
                  ) : (
                    <Text style={[styles.leaveBtnText, { color: colors.error }]}>{t('guild.leave')}</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Members header */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('guild.leaderboard')}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View
            style={[
              styles.memberRow,
              { backgroundColor: colors.bgCard },
              item.isCurrentUser && { borderLeftColor: colors.primary, borderLeftWidth: 3 },
            ]}
          >
            <Text style={[styles.memberRank, { color: colors.textSecondary }]}>#{item.rank}</Text>
            <View style={styles.memberInfo}>
              <Text style={[styles.memberName, { color: colors.text }, item.isCurrentUser && { color: colors.primary, fontWeight: '700' }]}>
                {ROLE_EMOJI[item.role]} {item.username} {item.isCurrentUser ? '(You)' : ''}
              </Text>
              <Text style={[styles.memberRole, { color: colors.textMuted }]}>{t(`guild.role_${item.role}`)}</Text>
            </View>
            <Text style={[styles.memberXp, { color: colors.xp }]}>{item.weeklyXp} XP</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: { paddingVertical: 12 },
  backText: { fontSize: 16, fontWeight: '600' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600' },
  guildCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1.5,
  },
  guildHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  guildName: { fontSize: 22, fontWeight: '800', flex: 1 },
  roleTag: { fontSize: 13, fontWeight: '700' },
  guildDesc: { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2 },
  leaveBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  leaveBtnText: { fontSize: 14, fontWeight: '700' },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    marginVertical: 3,
  },
  memberRank: { fontSize: 14, fontWeight: '700', width: 36 },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15 },
  memberRole: { fontSize: 11, marginTop: 2 },
  memberXp: { fontSize: 14, fontWeight: '700' },
});
