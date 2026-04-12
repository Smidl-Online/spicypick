import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { colors } from '../theme/colors';

const VERDICT_EMOJI: Record<string, string> = {
  guilty: '❌',
  not_guilty: '✅',
  complicated: '🤔',
  both_wrong: '⚡',
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

  const handleShare = async () => {
    try {
      const uri = await viewShotRef.current?.capture?.();
      if (uri) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png' });
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  return (
    <View>
      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
        <View style={styles.card}>
          <Text style={styles.header}>🌶️ SPICYPICK #{scenarioNumber}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>⚖️ My pick:</Text>
            <Text style={styles.value}>{VERDICT_EMOJI[userVerdict] || '?'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>👥 Community:</Text>
            <Text style={styles.value}>{communityPct}% {VERDICT_EMOJI[communityMajority]}</Text>
          </View>
          {streak > 0 && (
            <Text style={styles.streak}>🔥 Streak: {streak} days</Text>
          )}
          <Text style={styles.url}>
            {scenarioId ? `spicypick.app/scenario/${scenarioId}` : 'spicypick.app'}
          </Text>
        </View>
      </ViewShot>

      <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
        <Text style={styles.shareBtnText}>📤 Share your pick</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: colors.primary,
    marginVertical: 16,
  },
  header: { fontSize: 20, fontWeight: '800', color: colors.primary, marginBottom: 16, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 16, color: colors.textSecondary },
  value: { fontSize: 18, fontWeight: '700', color: colors.text },
  streak: { fontSize: 16, color: colors.streak, marginTop: 12, textAlign: 'center' },
  url: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 16 },
  shareBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  shareBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
