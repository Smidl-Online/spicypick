import React, { useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useGuildStore } from '../../src/store/guildStore';
import { useTheme } from '../../src/theme/ThemeContext';
import { useTranslation } from 'react-i18next';

const ROLE_EMOJI: Record<string, string> = {
  leader: '\u{1F451}',
  officer: '\u{1F6E1}\uFE0F',
  member: '\u{1F464}',
};

export default function GuildDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const {
    guildDetail, guildDetailMembers, isLoadingDetail, fetchGuildDetail,
    myGuild, joinGuild, isActing, error, clearError,
  } = useGuildStore();

  useEffect(() => {
    if (id) fetchGuildDetail(id);
  }, [id]);

  useEffect(() => {
    if (error) {
      Alert.alert(t('common.error'), error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error]);

  if (isLoadingDetail || !guildDetail) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const isMyGuild = myGuild?.id === guildDetail.id;
  const canJoin = !myGuild && guildDetail.memberCount < guildDetail.maxMembers;
  const isFull = guildDetail.memberCount >= guildDetail.maxMembers;

  const handleJoin = async () => {
    const success = await joinGuild(guildDetail.id);
    if (success) {
      router.replace('/guild/my-guild');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <FlatList
        data={guildDetailMembers}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        ListHeaderComponent={() => (
          <View>
            {/* Back button */}
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={[styles.backText, { color: colors.primary }]}>{'\u{2190}'} {t('common.cancel')}</Text>
            </TouchableOpacity>

            {/* Guild info */}
            <View style={[styles.guildCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.guildName, { color: colors.text }]}>{guildDetail.name}</Text>
              {guildDetail.description && (
                <Text style={[styles.guildDesc, { color: colors.textSecondary }]}>{guildDetail.description}</Text>
              )}
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.xp }]}>{guildDetail.weeklyXp}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>XP/week</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.text }]}>{guildDetail.totalXp}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total XP</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.text }]}>{guildDetail.memberCount}/{guildDetail.maxMembers}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('guild.members')}</Text>
                </View>
              </View>

              {/* Join button */}
              {canJoin && (
                <TouchableOpacity
                  style={[styles.joinBtn, { backgroundColor: colors.primary }]}
                  onPress={handleJoin}
                  disabled={isActing}
                >
                  {isActing ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.joinBtnText}>{t('guild.join')}</Text>
                  )}
                </TouchableOpacity>
              )}
              {isFull && !isMyGuild && (
                <Text style={[styles.fullText, { color: colors.error }]}>{t('guild.full')}</Text>
              )}
              {myGuild && !isMyGuild && (
                <Text style={[styles.fullText, { color: colors.textMuted }]}>{t('guild.already_in_guild')}</Text>
              )}
            </View>

            {/* Members header */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('guild.members')} ({guildDetailMembers.length})
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
  guildCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  guildName: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  guildDesc: { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2 },
  joinBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  joinBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  fullText: { textAlign: 'center', marginTop: 8, fontSize: 13 },
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
