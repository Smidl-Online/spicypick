import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api, ApiError } from '../../src/api/client';
import { colors } from '../../src/theme/colors';

type ArchiveScenario = {
  id: string;
  title: string;
  category: string;
  publishDate: string;
  totalVotes: number;
};

export default function ArchiveScreen() {
  const [scenarios, setScenarios] = useState<ArchiveScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [isPremium, setIsPremium] = useState(true);

  const fetchArchive = async (p: number) => {
    try {
      const data = await api<{ scenarios: ArchiveScenario[] }>(`/api/scenarios/archive/list?page=${p}&limit=20`);
      if (p === 1) {
        setScenarios(data.scenarios);
      } else {
        setScenarios((prev) => [...prev, ...data.scenarios]);
      }
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 403) {
        setIsPremium(false);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchive(1);
  }, []);

  if (!isPremium) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>👑</Text>
          <Text style={styles.emptyText}>Archive is a Premium feature</Text>
          <TouchableOpacity style={styles.premiumBtn} onPress={() => router.push('/settings/premium')}>
            <Text style={styles.premiumBtnText}>Get Premium</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>📚 Scenario Archive</Text>
      <FlatList
        data={scenarios}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        onEndReached={() => {
          setPage((p) => p + 1);
          fetchArchive(page + 1);
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={loading ? <ActivityIndicator color={colors.primary} /> : null}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/scenario/${item.id}`)}
          >
            <Text style={styles.date}>{item.publishDate}</Text>
            <Text style={styles.scenarioTitle}>{item.title}</Text>
            <View style={styles.meta}>
              <Text style={styles.category}>{item.category}</Text>
              <Text style={styles.votes}>{item.totalVotes} votes</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, paddingHorizontal: 16, marginVertical: 16 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 18, color: colors.textSecondary, marginBottom: 24 },
  premiumBtn: { backgroundColor: colors.accent, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  premiumBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 16,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  date: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  scenarioTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 8 },
  meta: { flexDirection: 'row', justifyContent: 'space-between' },
  category: { fontSize: 12, color: colors.primary, fontWeight: '600', textTransform: 'uppercase' },
  votes: { fontSize: 12, color: colors.textSecondary },
});
