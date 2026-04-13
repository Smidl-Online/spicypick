import React, { useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../src/theme/ThemeContext';
import { usePacksStore } from '../../../src/store/packsStore';
import { useAuthStore } from '../../../src/store/authStore';

const VALID_CATEGORIES = ['workplace', 'relationship', 'family', 'friends', 'money', 'neighbors'] as const;

const CATEGORY_ICONS: Record<string, string> = {
  workplace: '\uD83C\uDFE2',
  relationship: '\u2764\uFE0F',
  family: '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66',
  friends: '\uD83E\uDD1D',
  money: '\uD83D\uDCB0',
  neighbors: '\uD83C\uDFE0',
};

export default function PackDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const {
    packScenarios,
    isLoadingScenarios,
    isPremiumRequired,
    selectedCategory,
    error,
    fetchPackScenarios,
    loadMoreScenarios,
    setSelectedCategory,
    clearPackScenarios,
  } = usePacksStore();

  useEffect(() => {
    clearPackScenarios();
    if (id) fetchPackScenarios(id);
    return () => clearPackScenarios();
  }, [id]);

  const handleCategoryPress = useCallback((category: string | null) => {
    if (!user?.isPremium) {
      router.push('/settings/premium');
      return;
    }
    setSelectedCategory(category);
    if (id) fetchPackScenarios(id, category, 1);
  }, [id, user?.isPremium]);

  if (isPremiumRequired) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.premiumGate}>
          <Text style={styles.premiumEmoji}>{'\uD83D\uDC51'}</Text>
          <Text style={[styles.premiumTitle, { color: colors.text }]}>{t('packs.premium_required')}</Text>
          <Text style={[styles.premiumDesc, { color: colors.textSecondary }]}>{t('packs.premium_desc')}</Text>
          <TouchableOpacity
            style={[styles.premiumBtn, { backgroundColor: colors.accent }]}
            onPress={() => router.push('/settings/premium')}
          >
            <Text style={styles.premiumBtnText}>{t('packs.unlock_premium')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const packName = id ? id.charAt(0).toUpperCase() + id.slice(1) : '';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>{id ? (CATEGORY_ICONS[id] || '\uD83C\uDFAD') : '\uD83C\uDFAD'}</Text>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{packName}</Text>
      </View>

      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <TouchableOpacity
          style={[
            styles.chip,
            { borderColor: colors.border },
            !selectedCategory && { backgroundColor: colors.primary, borderColor: colors.primary },
          ]}
          onPress={() => handleCategoryPress(null)}
        >
          <Text style={[styles.chipText, { color: !selectedCategory ? '#fff' : colors.textSecondary }]}>
            {t('packs.filter_all')}
          </Text>
        </TouchableOpacity>
        {VALID_CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[
                styles.chip,
                { borderColor: colors.border },
                isActive && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => handleCategoryPress(cat)}
            >
              {!user?.isPremium && (
                <Text style={styles.chipLock}>{'\uD83D\uDD12'}</Text>
              )}
              <Text style={[styles.chipText, { color: isActive ? '#fff' : colors.textSecondary }]}>
                {t(`packs.category_${cat}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {isLoadingScenarios && packScenarios.length === 0 ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={[styles.errorText, { color: colors.error }]}>{t('common.error')}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => id && fetchPackScenarios(id, selectedCategory, 1)}
          >
            <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={packScenarios}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          onEndReached={() => id && loadMoreScenarios(id)}
          onEndReachedThreshold={0.5}
          ListFooterComponent={isLoadingScenarios ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} /> : null}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('packs.no_scenarios')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.scenarioCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
              onPress={() => router.push(`/scenario/${item.id}`)}
            >
              <Text style={[styles.scenarioDate, { color: colors.textMuted }]}>{item.publishDate}</Text>
              <Text style={[styles.scenarioTitle, { color: colors.text }]}>{item.title}</Text>
              <View style={styles.scenarioMeta}>
                <Text style={[styles.scenarioCategory, { color: colors.primary }]}>{item.category}</Text>
                <Text style={[styles.scenarioVotes, { color: colors.textSecondary }]}>
                  {item.totalVotes} {t('packs.votes')}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 16, marginBottom: 8 },
  headerIcon: { fontSize: 28, marginRight: 10 },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  filterRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  chipLock: { fontSize: 10, marginRight: 4 },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 },
  errorText: { fontSize: 16, marginBottom: 12 },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 8 },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  emptyText: { fontSize: 16 },
  scenarioCard: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 4,
    borderWidth: 1,
  },
  scenarioDate: { fontSize: 12, marginBottom: 4 },
  scenarioTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  scenarioMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  scenarioCategory: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  scenarioVotes: { fontSize: 12 },
  premiumGate: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  premiumEmoji: { fontSize: 64, marginBottom: 16 },
  premiumTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  premiumDesc: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  premiumBtn: { paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  premiumBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
