import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Linking from 'expo-linking';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from 'react-i18next';
import { analytics } from '../services/analytics';

const VERDICT_EMOJI: Record<string, string> = {
  guilty: '❌',
  not_guilty: '✅',
  complicated: '🤔',
  both_wrong: '⚡',
};

const VERDICT_LABELS: Record<string, string> = {
  guilty: 'Guilty',
  not_guilty: 'Not Guilty',
  complicated: "It's Complicated",
  both_wrong: 'Both Wrong',
};

type Props = {
  scenarioNumber: number;
  scenarioId?: string;
  userVerdict: string;
  communityMajority: string;
  communityPct: number;
  streak: number;
};

export function ShareCard({ scenarioNumber, scenarioId, userVerdict, communityMajority, communityPct, streak }: Props) {
  const viewShotRef = useRef<ViewShot>(null);
  const { colors } = useTheme();
  const { t } = useTranslation();

  const deepLinkUrl = scenarioId
    ? `https://spicypick.app/scenario/${scenarioId}`
    : 'https://spicypick.app';

  const handleShare = useCallback(async () => {
    try {
      const uri = await viewShotRef.current?.capture?.();
      if (uri) {
        analytics.track('share_card_shared', {
          scenarioNumber,
          scenarioId,
          userVerdict,
          platform: Platform.OS,
        });
        await Sharing.shareAsync(uri, { mimeType: 'image/png' });
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  }, [scenarioNumber, scenarioId, userVerdict]);

  const userEmoji = VERDICT_EMOJI[userVerdict] || '?';
  const communityEmoji = VERDICT_EMOJI[communityMajority] || '?';
  const matchesMajority = userVerdict === communityMajority;

  return (
    <View>
      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.primary }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={[styles.header, { color: colors.primary }]}>
              🌶️ SPICYPICK #{scenarioNumber}
            </Text>
          </View>

          {/* Big emoji verdict */}
          <View style={styles.emojiCenter}>
            <Text style={styles.bigEmoji}>{userEmoji}</Text>
            <Text style={[styles.verdictLabel, { color: colors.text }]}>
              {VERDICT_LABELS[userVerdict] || userVerdict}
            </Text>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* User vs community comparison */}
          <View style={styles.comparisonRow}>
            <View style={styles.comparisonCol}>
              <Text style={[styles.comparisonLabel, { color: colors.textSecondary }]}>
                {t('home.share_my_pick', { defaultValue: 'My Pick' })}
              </Text>
              <Text style={styles.comparisonEmoji}>{userEmoji}</Text>
            </View>
            <View style={styles.vsContainer}>
              <Text style={[styles.vsText, { color: colors.textMuted }]}>VS</Text>
            </View>
            <View style={styles.comparisonCol}>
              <Text style={[styles.comparisonLabel, { color: colors.textSecondary }]}>
                {t('home.share_community', { defaultValue: 'Community' })}
              </Text>
              <Text style={styles.comparisonEmoji}>{communityEmoji}</Text>
              <Text style={[styles.pctText, { color: colors.textSecondary }]}>
                {communityPct}%
              </Text>
            </View>
          </View>

          {/* Match badge */}
          {matchesMajority && (
            <View style={[styles.matchBadge, { backgroundColor: colors.success + '20', borderColor: colors.success }]}>
              <Text style={[styles.matchText, { color: colors.success }]}>
                🎯 {t('reveal.majority_match')}
              </Text>
            </View>
          )}

          {/* Streak */}
          {streak > 0 && (
            <Text style={[styles.streak, { color: colors.streak }]}>
              🔥 {t('home.streak', { count: streak })}
            </Text>
          )}

          {/* Deep link URL */}
          <Text style={[styles.url, { color: colors.textMuted }]}>{deepLinkUrl}</Text>
        </View>
      </ViewShot>

      <TouchableOpacity
        style={[styles.shareBtn, { backgroundColor: colors.primary }]}
        onPress={handleShare}
        activeOpacity={0.8}
      >
        <Text style={styles.shareBtnText}>📤 {t('home.share')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    marginVertical: 16,
  },
  headerRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  header: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  emojiCenter: {
    alignItems: 'center',
    marginBottom: 16,
  },
  bigEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  verdictLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 16,
  },
  comparisonCol: {
    alignItems: 'center',
    flex: 1,
  },
  comparisonLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  comparisonEmoji: {
    fontSize: 36,
  },
  pctText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  vsContainer: {
    paddingHorizontal: 16,
  },
  vsText: {
    fontSize: 16,
    fontWeight: '800',
  },
  matchBadge: {
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
  },
  matchText: {
    fontSize: 14,
    fontWeight: '600',
  },
  streak: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  url: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  shareBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  shareBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
