import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import { colors } from '../../src/theme/colors';
import { useTranslation } from 'react-i18next';
import { ChallengesSkeleton } from '../../src/components/SkeletonLoader';

type Challenge = {
  id: string;
  challenger: { username: string };
  challenged: { username: string };
  scenario: { title: string };
  challengerVerdict: string | null;
  challengedVerdict: string | null;
  status: string;
  isChallenger: boolean;
  createdAt: string;
};

const VERDICT_EMOJI: Record<string, string> = {
  guilty: '❌', not_guilty: '✅', complicated: '🤔', both_wrong: '⚡',
};

export default function ChallengesScreen() {
  const { t } = useTranslation();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchChallenges = async () => {
    try {
      const data = await api<{ challenges: Challenge[] }>('/api/challenges');
      setChallenges(data.challenges);
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChallenges();
  }, []);

  const handleRespond = async (challengeId: string, verdict: string) => {
    try {
      await api(`/api/challenges/${challengeId}/respond`, {
        method: 'POST',
        body: { verdict },
      });
      await fetchChallenges();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ChallengesSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>⚔️ {t('challenges.title')}</Text>

      {challenges.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🤝</Text>
          <Text style={styles.emptyText}>{t('challenges.empty')}</Text>
        </View>
      ) : (
        <FlatList
          data={challenges}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.opponent}>
                  {item.isChallenger ? item.challenged.username : item.challenger.username}
                </Text>
                <Text style={[styles.status, {
                  color: item.status === 'completed' ? colors.success : colors.warning,
                }]}>
                  {item.status === 'completed' ? t('challenges.completed') : t('challenges.pending')}
                </Text>
              </View>
              <Text style={styles.scenarioTitle}>{item.scenario.title}</Text>

              {item.status === 'completed' ? (
                <View style={styles.verdicts}>
                  <Text style={styles.verdictLabel}>
                    {item.challenger.username}: {VERDICT_EMOJI[item.challengerVerdict || ''] || '?'}
                  </Text>
                  <Text style={styles.verdictLabel}>
                    {item.challenged.username}: {VERDICT_EMOJI[item.challengedVerdict || ''] || '?'}
                  </Text>
                  <Text style={styles.matchResult}>
                    {item.challengerVerdict === item.challengedVerdict ? '🤝 Match!' : '🔥 Different picks!'}
                  </Text>
                </View>
              ) : !item.isChallenger && item.status === 'pending' ? (
                <View style={styles.respondButtons}>
                  <Text style={styles.respondLabel}>{t('challenges.respond')}</Text>
                  <View style={styles.buttonRow}>
                    {(['guilty', 'not_guilty', 'complicated', 'both_wrong'] as const).map((v) => (
                      <TouchableOpacity
                        key={v}
                        style={styles.miniButton}
                        onPress={() => handleRespond(item.id, v)}
                      >
                        <Text style={styles.miniButtonText}>{VERDICT_EMOJI[v]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : (
                <Text style={styles.waitingText}>Waiting for response...</Text>
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, paddingHorizontal: 16, marginVertical: 16 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 16, color: colors.textSecondary },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  opponent: { fontSize: 16, fontWeight: '700', color: colors.text },
  status: { fontSize: 12, fontWeight: '600' },
  scenarioTitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 12 },
  verdicts: { marginTop: 8 },
  verdictLabel: { fontSize: 14, color: colors.text, marginBottom: 4 },
  matchResult: { fontSize: 16, fontWeight: '700', color: colors.primary, marginTop: 8, textAlign: 'center' },
  respondButtons: { marginTop: 8 },
  respondLabel: { fontSize: 14, color: colors.textSecondary, marginBottom: 8 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-around' },
  miniButton: {
    backgroundColor: colors.bgLight,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  miniButtonText: { fontSize: 20 },
  waitingText: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', marginTop: 8 },
});
