import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp, SlideInDown } from 'react-native-reanimated';
import { useScenarioStore } from '../../src/store/scenarioStore';
import { useAuthStore } from '../../src/store/authStore';
import { VerdictButton } from '../../src/components/VerdictButton';
import { CommunityStats } from '../../src/components/CommunityStats';
import { CountdownTimer } from '../../src/components/CountdownTimer';
import { ShareCard } from '../../src/components/ShareCard';
import { StreakBadge } from '../../src/components/StreakBadge';
import { useTheme } from '../../src/theme/ThemeContext';
import { useTranslation } from 'react-i18next';

const VERDICTS = ['guilty', 'not_guilty', 'complicated', 'both_wrong'] as const;

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { todayScenario, hasVoted, userVerdict, communityStats, voteResult, fetchToday, vote, isLoading } = useScenarioStore();
  const { user, fetchProfile } = useAuthStore();
  const [voting, setVoting] = useState(false);
  const [showReveal, setShowReveal] = useState(false);

  const ds = useMemo(() => ({
    container: { flex: 1 as const, backgroundColor: colors.bg },
    title: { fontSize: 24, fontWeight: '800' as const, color: colors.primary },
    emptyText: { fontSize: 16, color: colors.textSecondary, textAlign: 'center' as const, marginBottom: 24 },
    card: { backgroundColor: colors.bgCard, borderRadius: 16, padding: 20, marginVertical: 8, borderWidth: 1, borderColor: colors.border },
    category: { fontSize: 12, fontWeight: '700' as const, color: colors.primary, letterSpacing: 1, marginBottom: 8 },
    scenarioTitle: { fontSize: 20, fontWeight: '700' as const, color: colors.text, marginBottom: 12 },
    scenarioBody: { fontSize: 16, color: colors.text, lineHeight: 24 },
    xpBanner: { backgroundColor: colors.bgLight, borderRadius: 12, padding: 16, alignItems: 'center' as const, marginVertical: 8, borderWidth: 1, borderColor: colors.xp },
    xpText: { fontSize: 20, fontWeight: '800' as const, color: colors.xp },
    majorityText: { fontSize: 14, color: colors.xp, marginTop: 4 },
    analysisCard: { backgroundColor: colors.bgCard, borderRadius: 12, padding: 16, marginVertical: 8, borderWidth: 1, borderColor: colors.accent },
    analysisTitle: { fontSize: 16, fontWeight: '700' as const, color: colors.accent, marginBottom: 8 },
    analysisText: { fontSize: 14, color: colors.text, lineHeight: 22 },
    verdictPrompt: { fontSize: 18, fontWeight: '700' as const, color: colors.text, textAlign: 'center' as const, marginVertical: 16 },
  }), [colors]);

  useEffect(() => {
    fetchToday();
  }, []);

  const handleVote = async (verdict: string) => {
    if (!todayScenario || voting) return;
    setVoting(true);
    try {
      await vote(todayScenario.id, verdict);
      setShowReveal(true);
      await fetchProfile();
    } catch (err: any) {
      console.error(err);
    } finally {
      setVoting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={ds.container}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={ds.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={ds.title}>🌶️ SpicyPick</Text>
          {user && <StreakBadge count={user.currentStreak} />}
        </View>

        {!todayScenario ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>😴</Text>
            <Text style={ds.emptyText}>{t('home.no_scenario')}</Text>
            <CountdownTimer />
          </View>
        ) : hasVoted && communityStats ? (
          /* Already voted — show results */
          <Animated.View entering={FadeIn.duration(500)}>
            <View style={ds.card}>
              <Text style={ds.category}>{todayScenario.category.toUpperCase()}</Text>
              <Text style={ds.scenarioTitle}>{todayScenario.title}</Text>
              <Text style={ds.scenarioBody}>{todayScenario.body}</Text>
            </View>

            {/* XP earned */}
            {voteResult && (
              <Animated.View entering={SlideInDown.delay(200)} style={ds.xpBanner}>
                <Text style={ds.xpText}>{t('reveal.xp_earned', { xp: voteResult.xpEarned })}</Text>
                {voteResult.majorityMatch && (
                  <Text style={ds.majorityText}>{t('reveal.majority_match')}</Text>
                )}
              </Animated.View>
            )}

            <CommunityStats stats={communityStats} userVerdict={userVerdict} />

            {/* Expert analysis */}
            {(todayScenario.expertAnalysis || voteResult?.expertAnalysis) && (
              <Animated.View entering={FadeInUp.delay(800)} style={ds.analysisCard}>
                <Text style={ds.analysisTitle}>{t('reveal.expert')}</Text>
                <Text style={ds.analysisText}>
                  {todayScenario.expertAnalysis || voteResult?.expertAnalysis}
                </Text>
              </Animated.View>
            )}

            {/* Share card */}
            {userVerdict && communityStats && (
              <ShareCard
                scenarioNumber={1}
                userVerdict={userVerdict}
                communityMajority={getMajority(communityStats)}
                communityPct={getMajorityPct(communityStats)}
                streak={user?.currentStreak || 0}
              />
            )}

            <CountdownTimer />
          </Animated.View>
        ) : (
          /* Show scenario + voting buttons */
          <Animated.View entering={FadeInUp.duration(600)}>
            <View style={ds.card}>
              <Text style={ds.category}>{todayScenario.category.toUpperCase()}</Text>
              <Text style={ds.scenarioTitle}>{todayScenario.title}</Text>
              <Text style={ds.scenarioBody}>{todayScenario.body}</Text>
            </View>

            <Text style={ds.verdictPrompt}>{t('home.verdict_prompt')}</Text>

            {VERDICTS.map((v) => (
              <VerdictButton
                key={v}
                verdict={v}
                onPress={() => handleVote(v)}
                disabled={voting}
              />
            ))}
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function getMajority(stats: { guilty: number; notGuilty: number; complicated: number; bothWrong: number }) {
  const entries = [
    { key: 'guilty', count: stats.guilty },
    { key: 'not_guilty', count: stats.notGuilty },
    { key: 'complicated', count: stats.complicated },
    { key: 'both_wrong', count: stats.bothWrong },
  ];
  entries.sort((a, b) => b.count - a.count);
  return entries[0].key;
}

function getMajorityPct(stats: { total: number; guilty: number; notGuilty: number; complicated: number; bothWrong: number }) {
  const max = Math.max(stats.guilty, stats.notGuilty, stats.complicated, stats.bothWrong);
  return stats.total > 0 ? Math.round((max / stats.total) * 100) : 0;
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 16 },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
});
