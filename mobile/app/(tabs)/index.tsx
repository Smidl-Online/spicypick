import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useScenarioStore } from '../../src/store/scenarioStore';
import { useAuthStore } from '../../src/store/authStore';
import { VerdictButton } from '../../src/components/VerdictButton';
import { CommunityStats } from '../../src/components/CommunityStats';
import { CountdownTimer } from '../../src/components/CountdownTimer';
import { ShareCard } from '../../src/components/ShareCard';
import { RevealAnimation } from '../../src/components/RevealAnimation';
import { StreakBadge } from '../../src/components/StreakBadge';
import { PredictionStep } from '../../src/components/PredictionStep';
import { PredictionResult } from '../../src/components/PredictionResult';
import { useTheme } from '../../src/theme/ThemeContext';
import { useTranslation } from 'react-i18next';
import { analytics } from '../../src/services/analytics';
import { adMobInterstitial } from '../../src/services/adMob';
import { ScenarioSkeleton } from '../../src/components/SkeletonLoader';
import { DemographicFilters } from '../../src/components/DemographicFilters';

const VERDICTS = ['guilty', 'not_guilty', 'complicated', 'both_wrong'] as const;

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { todayScenario, scenarioNumber, hasVoted, hasPredicted, userVerdict, communityStats, voteResult, fetchToday, predict, vote, isLoading, isOffline } = useScenarioStore();
  const [predictionSkipped, setPredictionSkipped] = useState(false);
  const { user, fetchProfile } = useAuthStore();
  const [voting, setVoting] = useState(false);
  const hasTrackedView = useRef(false);
  const adTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchToday();
  }, []);

  // Preload interstitial ad for free users
  useEffect(() => {
    if (user && !user.isPremium) {
      adMobInterstitial.load();
    }
  }, [user?.isPremium]);

  // Clean up ad timer on unmount
  useEffect(() => {
    return () => {
      if (adTimerRef.current) {
        clearTimeout(adTimerRef.current);
      }
    };
  }, []);

  // Track screen view and scenario read for funnel
  useEffect(() => {
    if (!hasTrackedView.current) {
      analytics.screen('Home');
      hasTrackedView.current = true;
    }
  }, []);

  useEffect(() => {
    if (todayScenario && hasTrackedView.current) {
      analytics.track('scenario_read', {
        scenarioId: todayScenario.id,
        scenarioNumber,
        category: todayScenario.category,
        source: 'today',
      });
    }
  }, [todayScenario?.id]);

  const showAdForFreeUser = useCallback(async () => {
    if (user?.isPremium) return;
    // Show interstitial ad after reveal for free users
    const shown = await adMobInterstitial.show();
    if (shown) {
      analytics.track('ad_interstitial_shown', { placement: 'post_vote_reveal' });
    }
  }, [user?.isPremium]);

  const handleVote = async (verdict: string) => {
    if (!todayScenario || voting) return;
    setVoting(true);

    analytics.track('vote_submitted', {
      scenarioId: todayScenario.id,
      verdict,
      scenarioNumber,
    });

    try {
      const result = await vote(todayScenario.id, verdict);
      // Skip fetchProfile when offline (vote returns null)
      if (result) {
        await fetchProfile();

        analytics.track('vote_result', {
          scenarioId: todayScenario.id,
          verdict,
          majorityMatch: result.majorityMatch,
          xpEarned: result.xpEarned,
          streak: result.streak,
          newAchievements: result.newAchievements,
        });

        // Show ad after a short delay to let the reveal animation play
        adTimerRef.current = setTimeout(() => {
          showAdForFreeUser();
          adTimerRef.current = null;
        }, 2500);
      } else {
        analytics.track('vote_offline', {
          scenarioId: todayScenario.id,
          verdict,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(message);
      analytics.track('vote_error', { error: message });
    } finally {
      setVoting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <ScenarioSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.primary }]}>🌶️ SpicyPick</Text>
          <View style={styles.headerRight}>
            {isOffline && (
              <View style={[styles.offlineBadge, { backgroundColor: colors.warning }]}>
                <Text style={styles.offlineText}>{t('home.offline')}</Text>
              </View>
            )}
            {user && <StreakBadge count={user.currentStreak} />}
          </View>
        </View>

        {!todayScenario ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>😴</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('home.no_scenario')}</Text>
            <CountdownTimer />
          </View>
        ) : hasVoted ? (
          <Animated.View entering={FadeIn.duration(500)}>
            <View style={[styles.scenarioCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.category, { color: colors.primary }]}>{todayScenario.category.toUpperCase()}</Text>
              <Text style={[styles.scenarioTitle, { color: colors.text }]}>{todayScenario.title}</Text>
              <Text style={[styles.scenarioBody, { color: colors.text }]}>{todayScenario.body}</Text>
            </View>

            {isOffline && !communityStats && (
              <View style={[styles.offlineVotedBanner, { backgroundColor: colors.bgLight, borderColor: colors.warning }]}>
                <Text style={[styles.offlineVotedText, { color: colors.text }]}>{t('home.offline_voted')}</Text>
              </View>
            )}

            {voteResult && (
              <RevealAnimation
                majorityMatch={voteResult.majorityMatch}
                xpEarned={voteResult.xpEarned}
                streak={voteResult.streak}
                newAchievements={voteResult.newAchievements}
              />
            )}

            {voteResult?.prediction && (
              <PredictionResult
                isCorrect={voteResult.prediction.isCorrect}
                xpEarned={voteResult.prediction.xpEarned}
                predictedVerdict={voteResult.prediction.predictedVerdict}
              />
            )}

            {communityStats && (
              <CommunityStats stats={communityStats} userVerdict={userVerdict} />
            )}

            {communityStats && todayScenario && (
              <DemographicFilters
                scenarioId={todayScenario.id}
                isPremium={user?.isPremium ?? false}
                onPremiumCta={() => router.push('/settings/premium')}
              />
            )}

            {(todayScenario.expertAnalysis || voteResult?.expertAnalysis) && (
              <Animated.View entering={FadeInUp.delay(800)} style={[styles.analysisCard, { backgroundColor: colors.bgCard, borderColor: colors.accent }]}>
                <Text style={[styles.analysisTitle, { color: colors.accent }]}>{t('reveal.expert')}</Text>
                <Text style={[styles.analysisText, { color: colors.text }]}>
                  {todayScenario.expertAnalysis || voteResult?.expertAnalysis}
                </Text>
              </Animated.View>
            )}

            {userVerdict && communityStats && (
              <ShareCard
                scenarioNumber={scenarioNumber || 1}
                scenarioId={todayScenario.id}
                userVerdict={userVerdict}
                communityMajority={getMajority(communityStats)}
                communityPct={getMajorityPct(communityStats)}
                streak={user?.currentStreak || 0}
              />
            )}

            <CountdownTimer />
          </Animated.View>
        ) : !hasPredicted && !predictionSkipped ? (
          <Animated.View entering={FadeInUp.duration(600)}>
            <View style={[styles.scenarioCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.category, { color: colors.primary }]}>{todayScenario.category.toUpperCase()}</Text>
              <Text style={[styles.scenarioTitle, { color: colors.text }]}>{todayScenario.title}</Text>
              <Text style={[styles.scenarioBody, { color: colors.text }]}>{todayScenario.body}</Text>
            </View>

            <PredictionStep
              onPredict={async (verdict) => {
                analytics.track('prediction_submitted', {
                  scenarioId: todayScenario.id,
                  predictedVerdict: verdict,
                  scenarioNumber,
                });
                await predict(todayScenario.id, verdict);
              }}
              onSkip={() => {
                analytics.track('prediction_skipped', {
                  scenarioId: todayScenario.id,
                  scenarioNumber,
                });
                setPredictionSkipped(true);
              }}
            />
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInUp.duration(600)}>
            <View style={[styles.scenarioCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.category, { color: colors.primary }]}>{todayScenario.category.toUpperCase()}</Text>
              <Text style={[styles.scenarioTitle, { color: colors.text }]}>{todayScenario.title}</Text>
              <Text style={[styles.scenarioBody, { color: colors.text }]}>{todayScenario.body}</Text>
            </View>

            <Text style={[styles.verdictPrompt, { color: colors.text }]}>{t('home.verdict_prompt')}</Text>

            {VERDICTS.map((v) => (
              <VerdictButton
                key={v}
                verdict={v}
                onPress={() => handleVote(v)}
                disabled={voting}
              />
            ))}

            {isOffline && (
              <Text style={[styles.offlineHint, { color: colors.textMuted }]}>
                {t('home.offline_hint')}
              </Text>
            )}
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
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 16 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '800' },
  offlineBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  offlineText: { fontSize: 11, fontWeight: '700', color: '#1a1a2e' },
  offlineHint: { fontSize: 13, textAlign: 'center', marginTop: 16 },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 16, textAlign: 'center', marginBottom: 24 },
  scenarioCard: { borderRadius: 16, padding: 20, marginVertical: 8, borderWidth: 1 },
  category: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  scenarioTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  scenarioBody: { fontSize: 16, lineHeight: 24 },
  verdictPrompt: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginVertical: 16 },
  analysisCard: { borderRadius: 12, padding: 16, marginVertical: 8, borderWidth: 1 },
  analysisTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  analysisText: { fontSize: 14, lineHeight: 22 },
  offlineVotedBanner: { borderRadius: 12, padding: 16, alignItems: 'center', marginVertical: 8, borderWidth: 1 },
  verificationBanner: { borderRadius: 12, padding: 16, marginVertical: 8, borderWidth: 1, gap: 12 },
  verificationBannerText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  verificationBannerButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, alignSelf: 'center' },
  verificationBannerButtonText: { color: 'white', fontWeight: '600', fontSize: 14 },
  offlineVotedText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
