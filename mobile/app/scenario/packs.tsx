import React, { useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../src/theme/ThemeContext';
import { usePacksStore, Pack } from '../../src/store/packsStore';

const PACK_ICONS: Record<string, string> = {
  workplace: '\uD83C\uDFE2',    // office building
  relationship: '\u2764\uFE0F',  // heart
  family: '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66', // family
  friends: '\uD83E\uDD1D',       // handshake
  money: '\uD83D\uDCB0',         // money bag
  neighbors: '\uD83C\uDFE0',     // house
};

function PackCard({ pack, colors, t }: { pack: Pack; colors: any; t: any }) {
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
      onPress={() => router.push(`/scenario/pack/${pack.id}`)}
      activeOpacity={0.7}
    >
      <Text style={styles.cardIcon}>{PACK_ICONS[pack.id] || '\uD83C\uDFAD'}</Text>
      <View style={styles.cardContent}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{pack.name}</Text>
        <Text style={[styles.cardCount, { color: colors.textSecondary }]}>
          {t('packs.scenarios_count', { count: pack.scenarioCount })}
        </Text>
      </View>
      <Text style={[styles.chevron, { color: colors.textMuted }]}>{'\u203A'}</Text>
    </TouchableOpacity>
  );
}

export default function PacksScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { packs, isLoadingPacks, error, fetchPacks } = usePacksStore();

  useEffect(() => {
    fetchPacks();
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.text }]}>{t('packs.title')}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('packs.subtitle')}</Text>

      {isLoadingPacks && packs.length === 0 ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={[styles.errorText, { color: colors.error }]}>{t('common.error')}</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={fetchPacks}>
            <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={packs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          renderItem={({ item }) => <PackCard pack={item} colors={colors} t={t} />}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('packs.empty')}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 24, fontWeight: '800', paddingHorizontal: 16, marginTop: 16 },
  subtitle: { fontSize: 14, paddingHorizontal: 16, marginTop: 4, marginBottom: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginVertical: 4,
    borderWidth: 1,
  },
  cardIcon: { fontSize: 32, marginRight: 14 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  cardCount: { fontSize: 13 },
  chevron: { fontSize: 24 },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 },
  errorText: { fontSize: 16, marginBottom: 12 },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 8 },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  emptyText: { fontSize: 16 },
});
