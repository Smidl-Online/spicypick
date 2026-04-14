import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Animated, {
  FadeInUp,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

import { api } from '../api/client';
import { colors } from '../theme/colors';
import { useTranslation } from 'react-i18next';
import { MoralProfileChart } from './MoralProfileChart';
import { analytics } from '../services/analytics';

type MoralProfileData = {
  profile: {
    forgiving: number;
    pragmatic: number;
    empathetic: number;
    confrontational: number;
    majorityAligned: number;
    consistent: number;
  } | null;
  totalVotesAnalyzed: number;
  minimumVotesRequired: number;
  isReady: boolean;
  lastCalculatedAt: string | null;
  votesUntilReady?: number;
};

type Props = {
  isFirstReveal?: boolean;
};

export function MoralProfileSection({ isFirstReveal = false }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<MoralProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const viewShotRef = useRef<ViewShot>(null);

  // Celebration animation values
  const celebrationScale = useSharedValue(0);
  const celebrationOpacity = useSharedValue(0);

  useEffect(() => {
    api<MoralProfileData>('/api/users/me/moral-profile')
      .then((result) => {
        setData(result);
        if (isFirstReveal && result.isReady) {
          celebrationOpacity.value = withTiming(1, { duration: 300 });
          celebrationScale.value = withSequence(
            withSpring(1.2, { damping: 8, stiffness: 200 }),
            withDelay(800, withSpring(1, { damping: 12 })),
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const celebrationStyle = useAnimatedStyle(() => ({
    opacity: celebrationOpacity.value,
    transform: [{ scale: celebrationScale.value }],
  }));

  const handleShare = useCallback(async () => {
    try {
      const uri = await viewShotRef.current?.capture?.();
      if (uri) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png' });
        analytics.track('moral_profile_shared', { platform: Platform.OS });
      }
    } catch (err) {
      console.error('Share moral profile failed:', err);
    }
  }, []);

  if (loading) return null;
  if (!data) return null;

  // Not enough votes
  if (!data.isReady) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>{t('moralProfile.title')}</Text>
        <View style={styles.notReadyCard}>
          <Text style={styles.notReadyEmoji}>🧭</Text>
          <Text style={styles.notReadyText}>
            {t('moralProfile.notReady')}
          </Text>
          <Text style={styles.votesNeeded}>
            {t('moralProfile.votesNeeded', { count: data.votesUntilReady || 0 })}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{t('moralProfile.title')}</Text>

      {/* Celebration overlay for first reveal */}
      {isFirstReveal && (
        <Animated.View style={[styles.celebration, celebrationStyle]}>
          <Text style={styles.celebrationEmoji}>🎉</Text>
          <Text style={styles.celebrationText}>
            {t('moralProfile.revealed')}
          </Text>
        </Animated.View>
      )}

      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
        <Animated.View
          entering={isFirstReveal ? FadeInUp.delay(400).springify().damping(12) : FadeIn.duration(300)}
          style={styles.profileCard}
        >
          <MoralProfileChart profile={data.profile!} />

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {t('moralProfile.basedOn', { count: data.totalVotesAnalyzed })}
            </Text>
          </View>

          <Text style={styles.watermark}>spicypick.app</Text>
        </Animated.View>
      </ViewShot>

      <TouchableOpacity
        style={styles.shareBtn}
        onPress={handleShare}
        activeOpacity={0.8}
      >
        <Text style={styles.shareBtnText}>📤 {t('moralProfile.share')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  profileCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaRow: {
    marginTop: 16,
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  watermark: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.5,
  },
  shareBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  shareBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  notReadyCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  notReadyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  notReadyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  votesNeeded: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  celebration: {
    alignItems: 'center',
    marginBottom: 16,
  },
  celebrationEmoji: {
    fontSize: 56,
  },
  celebrationText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.accent,
    marginTop: 8,
  },
});
