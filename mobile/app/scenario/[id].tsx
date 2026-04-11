import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { api } from '../../src/api/client';
import { CommunityStats } from '../../src/components/CommunityStats';
import { colors } from '../../src/theme/colors';

type ScenarioDetail = {
  scenario: {
    id: string;
    title: string;
    body: string;
    category: string;
    expertAnalysis: string | null;
    outcome: string | null;
  };
  voted: boolean;
  userVerdict: string | null;
  communityStats: {
    total: number;
    guilty: number;
    notGuilty: number;
    complicated: number;
    bothWrong: number;
  } | null;
};

export default function ScenarioDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<ScenarioDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      api<ScenarioDetail>(`/api/scenarios/${id}`)
        .then(setData)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.error}>Scenario not found</Text>
      </SafeAreaView>
    );
  }

  const { scenario, voted, userVerdict, communityStats } = data;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.category}>{scenario.category.toUpperCase()}</Text>
        <Text style={styles.title}>{scenario.title}</Text>
        <Text style={styles.body}>{scenario.body}</Text>

        {voted && communityStats && (
          <CommunityStats stats={communityStats} userVerdict={userVerdict} />
        )}

        {scenario.expertAnalysis && (
          <View style={styles.analysisCard}>
            <Text style={styles.analysisTitle}>Expert Analysis</Text>
            <Text style={styles.analysisText}>{scenario.expertAnalysis}</Text>
          </View>
        )}

        {scenario.outcome && (
          <View style={styles.outcomeCard}>
            <Text style={styles.outcomeTitle}>What Actually Happened</Text>
            <Text style={styles.outcomeText}>{scenario.outcome}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingVertical: 24, paddingBottom: 40 },
  category: { fontSize: 12, fontWeight: '700', color: colors.primary, letterSpacing: 1, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 16 },
  body: { fontSize: 16, color: colors.text, lineHeight: 24, marginBottom: 24 },
  error: { fontSize: 16, color: colors.error, textAlign: 'center', marginTop: 100 },
  analysisCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  analysisTitle: { fontSize: 16, fontWeight: '700', color: colors.accent, marginBottom: 8 },
  analysisText: { fontSize: 14, color: colors.text, lineHeight: 22 },
  outcomeCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: colors.success,
  },
  outcomeTitle: { fontSize: 16, fontWeight: '700', color: colors.success, marginBottom: 8 },
  outcomeText: { fontSize: 14, color: colors.text, lineHeight: 22 },
});
