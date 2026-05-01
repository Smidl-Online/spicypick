import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { XpBar } from '../../src/components/XpBar';
import { StreakBadge } from '../../src/components/StreakBadge';
import { api } from '../../src/api/client';
import { colors } from '../../src/theme/colors';
import { useTranslation } from 'react-i18next';
import { ProfileSkeleton } from '../../src/components/SkeletonLoader';
import { MoralProfileSection } from '../../src/components/MoralProfileSection';

type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt: string | null;
};

type PredictionStats = {
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  totalXpFromPredictions: number;
};

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { user, fetchProfile } = useAuthStore();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [predictionStats, setPredictionStats] = useState<PredictionStats | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    api<{ achievements: Achievement[] }>('/api/achievements')
      .then((data) => setAchievements(data.achievements))
      .catch(() => {});
    api<PredictionStats>('/api/users/me/prediction-stats')
      .then((data) => setPredictionStats(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) {
      const timeout = setTimeout(() => setLoadError(true), 10000);
      return () => clearTimeout(timeout);
    }
    setLoadError(false);
  }, [user]);

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        {loadError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{t('profile.load_error', { defaultValue: 'Failed to load profile' })}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoadError(false); fetchProfile(); }}>
              <Text style={styles.retryBtnText}>{t('common.retry', { defaultValue: 'Retry' })}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ProfileSkeleton />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} testID="profile-screen">
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Profile header */}
        <View style={styles.profileHeader} testID="profile-header">
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.username[0].toUpperCase()}</Text>
          </View>
          <Text style={styles.username}>{user.username}</Text>
          <Text style={styles.level}>{t('profile.level', { level: user.level })}</Text>
          <XpBar xp={user.xp} level={user.level} testID="profile-xp-bar" />
        </View>

        {/* Stats row */}
        <View style={styles.statsRow} testID="profile-stats">
          <View style={styles.statItem}>
            <StreakBadge count={user.currentStreak} />
            <Text style={styles.statLabel}>{t('profile.longest_streak', { count: user.longestStreak })}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user.totalVotes}</Text>
            <Text style={styles.statLabel}>Verdicts</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user.streakFreezes}</Text>
            <Text style={styles.statLabel}>Freezes</Text>
          </View>
        </View>

        {/* Prediction Stats */}
        {predictionStats && predictionStats.totalPredictions > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t('prediction.stats_title')}</Text>
            <View style={styles.predictionStats}>
              <View style={styles.predStatItem}>
                <Text style={styles.predStatValue}>{predictionStats.totalPredictions}</Text>
                <Text style={styles.statLabel}>{t('prediction.stats_total', { count: predictionStats.totalPredictions }).replace(`${predictionStats.totalPredictions} `, '')}</Text>
              </View>
              <View style={styles.predStatItem}>
                <Text style={[styles.predStatValue, { color: colors.success }]}>{predictionStats.accuracy}%</Text>
                <Text style={styles.statLabel}>{t('prediction.stats_accuracy', { percent: predictionStats.accuracy }).replace(`${predictionStats.accuracy}% `, '')}</Text>
              </View>
              <View style={styles.predStatItem}>
                <Text style={[styles.predStatValue, { color: colors.xp }]}>{predictionStats.totalXpFromPredictions}</Text>
                <Text style={styles.statLabel}>XP</Text>
              </View>
            </View>
          </>
        )}

        {/* Moral Profile */}
        <MoralProfileSection />

        {/* Achievements */}
        <Text style={styles.sectionTitle}>{t('profile.achievements')}</Text>
        <View style={styles.achievementsGrid} testID="profile-achievements">
          {achievements.map((a) => (
            <View key={a.id} style={[styles.achievementItem, !a.unlocked && styles.locked]}>
              <Text style={styles.achievementIcon}>{a.icon}</Text>
              <Text style={styles.achievementName}>{a.name}</Text>
              {!a.unlocked && <View style={styles.lockOverlay} />}
            </View>
          ))}
        </View>

        {/* Settings button */}
        <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/settings')} testID="profile-settings-button">
          <Text style={styles.settingsBtnText}>⚙️ {t('profile.settings')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  profileHeader: { alignItems: 'center', paddingVertical: 24 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  username: { fontSize: 22, fontWeight: '700', color: colors.text },
  level: { fontSize: 14, color: colors.xp, marginTop: 4, marginBottom: 8 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 24, marginBottom: 12 },
  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  achievementItem: {
    width: '30%',
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  locked: { opacity: 0.4 },
  achievementIcon: { fontSize: 28, marginBottom: 6 },
  achievementName: { fontSize: 11, color: colors.text, textAlign: 'center', fontWeight: '600' },
  lockOverlay: { position: 'absolute', top: 4, right: 4 },
  predictionStats: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: colors.bgCard, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border },
  predStatItem: { alignItems: 'center' },
  predStatValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  settingsBtn: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingsBtnText: { fontSize: 16, fontWeight: '600', color: colors.text },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 16, color: colors.textSecondary, marginBottom: 16, textAlign: 'center' },
  retryBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  retryBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
