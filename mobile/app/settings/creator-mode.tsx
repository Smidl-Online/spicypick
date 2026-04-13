import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, StatusBar } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useScenarioStore } from '../../src/store/scenarioStore';
import { useTheme } from '../../src/theme/ThemeContext';
import { useTranslation } from 'react-i18next';
import { analytics } from '../../src/services/analytics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const VERDICT_EMOJI: Record<string, string> = {
  guilty: '❌',
  not_guilty: '✅',
  complicated: '🤔',
  both_wrong: '⚡',
};

const VERDICT_COLOR_KEYS: Record<string, string> = {
  guilty: 'guilty',
  not_guilty: 'notGuilty',
  complicated: 'complicated',
  both_wrong: 'bothWrong',
};

type OverlayPhase = 'idle' | 'countdown' | 'scenario' | 'verdict';

export default function CreatorModeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { todayScenario, hasVoted, userVerdict, communityStats } = useScenarioStore();

  const [phase, setPhase] = useState<OverlayPhase>('idle');
  const [countdownValue, setCountdownValue] = useState(3);

  const countdownScale = useSharedValue(1);
  const countdownOpacity = useSharedValue(1);
  const scenarioProgress = useSharedValue(0);

  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    analytics.screen('CreatorMode');
    // Hide status bar for full-screen recording experience
    StatusBar.setHidden(true);
    return () => {
      StatusBar.setHidden(false);
      if (countdownTimerRef.current) {
        clearTimeout(countdownTimerRef.current);
      }
    };
  }, []);

  const startCountdown = useCallback(() => {
    setPhase('countdown');
    setCountdownValue(3);

    analytics.track('creator_mode_start', {
      hasScenario: !!todayScenario,
      hasVoted,
    });

    let count = 3;
    const tick = () => {
      if (count <= 0) {
        setPhase('scenario');
        // Auto-advance to verdict after 8 seconds if user has voted
        if (hasVoted && userVerdict) {
          countdownTimerRef.current = setTimeout(() => {
            setPhase('verdict');
          }, 8000);
        }
        return;
      }
      setCountdownValue(count);
      countdownScale.value = 1.5;
      countdownOpacity.value = 1;
      countdownScale.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });
      countdownOpacity.value = withDelay(600, withTiming(0, { duration: 200 }));
      count--;
      countdownTimerRef.current = setTimeout(tick, 1000);
    };
    tick();
  }, [todayScenario, hasVoted, userVerdict]);

  const showVerdict = useCallback(() => {
    if (countdownTimerRef.current) {
      clearTimeout(countdownTimerRef.current);
    }
    setPhase('verdict');
  }, []);

  const resetOverlay = useCallback(() => {
    if (countdownTimerRef.current) {
      clearTimeout(countdownTimerRef.current);
    }
    setPhase('idle');
  }, []);

  const countdownAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: countdownScale.value }],
    opacity: countdownOpacity.value,
  }));

  const getMajorityVerdict = () => {
    if (!communityStats) return null;
    const entries = [
      { key: 'guilty', count: communityStats.guilty },
      { key: 'not_guilty', count: communityStats.notGuilty },
      { key: 'complicated', count: communityStats.complicated },
      { key: 'both_wrong', count: communityStats.bothWrong },
    ];
    entries.sort((a, b) => b.count - a.count);
    return entries[0];
  };

  const getMajorityPct = () => {
    if (!communityStats || communityStats.total === 0) return 0;
    const max = Math.max(communityStats.guilty, communityStats.notGuilty, communityStats.complicated, communityStats.bothWrong);
    return Math.round((max / communityStats.total) * 100);
  };

  if (!todayScenario) {
    return (
      <View style={[styles.container, { backgroundColor: '#000' }]}>
        <View style={styles.centerContent}>
          <Text style={styles.noScenarioEmoji}>😴</Text>
          <Text style={[styles.noScenarioText, { color: '#fff' }]}>{t('creator.no_scenario')}</Text>
        </View>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      {/* Watermark — always visible */}
      <View style={styles.watermark}>
        <Text style={styles.watermarkText}>🌶️ SpicyPick</Text>
      </View>

      {/* IDLE phase — instructions */}
      {phase === 'idle' && (
        <Animated.View entering={FadeIn.duration(300)} style={styles.idleContainer}>
          <View style={styles.instructionCard}>
            <Text style={styles.instructionEmoji}>🎬</Text>
            <Text style={[styles.instructionTitle, { color: '#fff' }]}>{t('creator.title')}</Text>
            <Text style={[styles.instructionBody, { color: 'rgba(255,255,255,0.7)' }]}>{t('creator.instructions')}</Text>

            {!hasVoted && (
              <View style={[styles.warningBadge, { backgroundColor: colors.warning + '30', borderColor: colors.warning }]}>
                <Text style={[styles.warningText, { color: colors.warning }]}>{t('creator.vote_first')}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={[styles.startButton, { backgroundColor: colors.primary }]} onPress={startCountdown} activeOpacity={0.8}>
            <Text style={styles.startButtonText}>{t('creator.start')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
            <Text style={[styles.cancelText, { color: 'rgba(255,255,255,0.5)' }]}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* COUNTDOWN phase */}
      {phase === 'countdown' && (
        <View style={styles.countdownContainer}>
          <Animated.Text style={[styles.countdownNumber, countdownAnimStyle]}>
            {countdownValue}
          </Animated.Text>
          <Text style={styles.countdownLabel}>{t('creator.get_ready')}</Text>
        </View>
      )}

      {/* SCENARIO phase — show scenario text */}
      {phase === 'scenario' && (
        <Animated.View entering={FadeInUp.duration(500)} style={styles.overlayContent}>
          <View style={styles.scenarioOverlay}>
            <Text style={styles.overlayCategory}>{todayScenario.category.toUpperCase()}</Text>
            <Text style={styles.overlayTitle}>{todayScenario.title}</Text>
            <View style={styles.overlayDivider} />
            <Text style={styles.overlayBody}>{todayScenario.body}</Text>
          </View>

          {/* Bottom controls */}
          <View style={styles.overlayControls}>
            {hasVoted && userVerdict && (
              <TouchableOpacity style={[styles.controlButton, { backgroundColor: colors.primary }]} onPress={showVerdict} activeOpacity={0.8}>
                <Text style={styles.controlButtonText}>{t('creator.show_verdict')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.controlButton, { backgroundColor: 'rgba(255,255,255,0.15)' }]} onPress={resetOverlay}>
              <Text style={styles.controlButtonText}>{t('creator.reset')}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* VERDICT phase — show verdict + community stats */}
      {phase === 'verdict' && (
        <Animated.View entering={FadeInUp.duration(500)} style={styles.overlayContent}>
          <View style={styles.verdictOverlay}>
            <Text style={styles.verdictPhaseLabel}>{t('creator.my_verdict')}</Text>

            {userVerdict && (
              <View style={styles.verdictDisplay}>
                <Text style={styles.verdictEmoji}>{VERDICT_EMOJI[userVerdict] || '?'}</Text>
                <Text style={[styles.verdictText, { color: (colors as any)[VERDICT_COLOR_KEYS[userVerdict]] || '#fff' }]}>
                  {t(`verdicts.${userVerdict}`)}
                </Text>
              </View>
            )}

            {communityStats && (
              <>
                <View style={styles.overlayDivider} />
                <Text style={styles.communityLabel}>{t('reveal.community')}</Text>
                <View style={styles.statsContainer}>
                  {(['guilty', 'not_guilty', 'complicated', 'both_wrong'] as const).map((v) => {
                    const count = v === 'guilty' ? communityStats.guilty
                      : v === 'not_guilty' ? communityStats.notGuilty
                      : v === 'complicated' ? communityStats.complicated
                      : communityStats.bothWrong;
                    const pct = communityStats.total > 0 ? Math.round((count / communityStats.total) * 100) : 0;
                    const isUser = v === userVerdict;
                    return (
                      <View key={v} style={styles.statRow}>
                        <Text style={styles.statEmoji}>{VERDICT_EMOJI[v]}</Text>
                        <View style={styles.statBarBg}>
                          <View style={[styles.statBarFill, { width: `${pct}%`, backgroundColor: (colors as any)[VERDICT_COLOR_KEYS[v]] || '#fff' }]} />
                        </View>
                        <Text style={[styles.statPct, isUser && { fontWeight: '800' }]}>{pct}%</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </View>

          {/* Bottom controls */}
          <View style={styles.overlayControls}>
            <TouchableOpacity style={[styles.controlButton, { backgroundColor: 'rgba(255,255,255,0.15)' }]} onPress={() => setPhase('scenario')}>
              <Text style={styles.controlButtonText}>{t('creator.back_to_scenario')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.controlButton, { backgroundColor: 'rgba(255,255,255,0.15)' }]} onPress={resetOverlay}>
              <Text style={styles.controlButtonText}>{t('creator.reset')}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  noScenarioEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  noScenarioText: {
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 26,
  },
  backButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 32,
    marginBottom: 48,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  // Watermark
  watermark: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 100,
    opacity: 0.6,
  },
  watermarkText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },

  // Idle phase
  idleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  instructionCard: {
    alignItems: 'center',
    marginBottom: 40,
  },
  instructionEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  instructionTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  instructionBody: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  warningBadge: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  warningText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  startButton: {
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 16,
    marginBottom: 16,
    minWidth: 200,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  cancelButton: {
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 15,
  },

  // Countdown
  countdownContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownNumber: {
    fontSize: 120,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(233,69,96,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },
  countdownLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 16,
    fontWeight: '600',
  },

  // Overlay content (scenario + verdict)
  overlayContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  scenarioOverlay: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  overlayCategory: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#e94560',
    marginBottom: 8,
  },
  overlayTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 12,
    lineHeight: 28,
  },
  overlayDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 12,
  },
  overlayBody: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 24,
  },

  // Verdict phase
  verdictOverlay: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  verdictPhaseLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  verdictDisplay: {
    alignItems: 'center',
    marginBottom: 8,
  },
  verdictEmoji: {
    fontSize: 56,
    marginBottom: 8,
  },
  verdictText: {
    fontSize: 22,
    fontWeight: '800',
  },
  communityLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  statsContainer: {
    gap: 8,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statEmoji: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
  },
  statBarBg: {
    flex: 1,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  statBarFill: {
    height: '100%',
    borderRadius: 10,
    opacity: 0.8,
  },
  statPct: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    width: 40,
    textAlign: 'right',
  },

  // Bottom controls
  overlayControls: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
  },
  controlButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  controlButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
