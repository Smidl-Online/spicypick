import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, FlatList } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/api/client';
import { colors } from '../../src/theme/colors';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, saveLocale } from '../../src/i18n';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { logout, user } = useAuthStore();
  const [langPickerVisible, setLangPickerVisible] = useState(false);

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) || SUPPORTED_LANGUAGES[0];

  const changeLanguage = async (code: string) => {
    const previousLang = i18n.language;
    await i18n.changeLanguage(code);
    setLangPickerVisible(false);
    try {
      await saveLocale(code);
      await api('/api/users/me', { method: 'PATCH', body: JSON.stringify({ locale: code }) });
    } catch (err) {
      console.warn('Failed to persist locale:', err);
      await i18n.changeLanguage(previousLang);
      await saveLocale(previousLang);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api('/api/auth/account', { method: 'DELETE' });
              await logout();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.row} onPress={() => router.push('/settings/notifications')}>
        <Text style={styles.rowIcon}>🔔</Text>
        <Text style={styles.rowText}>{t('settings.notifications')}</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.row} onPress={() => router.push('/settings/premium')}>
        <Text style={styles.rowIcon}>👑</Text>
        <Text style={styles.rowText}>{t('settings.premium')}</Text>
        {user?.isPremium && <Text style={styles.badge}>Active</Text>}
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.row} onPress={() => setLangPickerVisible(true)}>
        <Text style={styles.rowIcon}>🌐</Text>
        <Text style={styles.rowText}>{t('settings.language')}</Text>
        <Text style={styles.langValue}>{currentLang.name}</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.row} onPress={() => router.push('/scenario/archive')}>
        <Text style={styles.rowIcon}>📚</Text>
        <Text style={styles.rowText}>Scenario Archive</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <View style={styles.spacer} />

      <Modal visible={langPickerVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('settings.language')}</Text>
            <FlatList
              data={SUPPORTED_LANGUAGES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.langRow, item.code === i18n.language && styles.langRowActive]}
                  onPress={() => changeLanguage(item.code)}
                >
                  <Text style={[styles.langText, item.code === i18n.language && styles.langTextActive]}>
                    {item.name}
                  </Text>
                  {item.code === i18n.language && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setLangPickerVisible(false)}>
              <Text style={styles.modalCloseText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <TouchableOpacity style={styles.row} onPress={logout}>
        <Text style={styles.rowIcon}>���</Text>
        <Text style={[styles.rowText, { color: colors.warning }]}>{t('settings.logout')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.row} onPress={handleDeleteAccount}>
        <Text style={styles.rowIcon}>⚠️</Text>
        <Text style={[styles.rowText, { color: colors.error }]}>{t('settings.delete_account')}</Text>
      </TouchableOpacity>

      <Text style={styles.version}>SpicyPick v1.0.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowIcon: { fontSize: 20, marginRight: 12 },
  rowText: { fontSize: 16, color: colors.text, flex: 1 },
  chevron: { fontSize: 20, color: colors.textMuted },
  badge: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    backgroundColor: colors.bgCard,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 8,
  },
  langValue: { fontSize: 14, color: colors.textMuted, marginRight: 8 },
  spacer: { height: 32 },
  version: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 32 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, maxHeight: '60%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  langRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  langRowActive: { backgroundColor: colors.primary + '15' },
  langText: { fontSize: 16, color: colors.text, flex: 1 },
  langTextActive: { fontWeight: '700', color: colors.primary },
  checkmark: { fontSize: 18, color: colors.primary, fontWeight: '700' },
  modalClose: { paddingVertical: 16, alignItems: 'center' },
  modalCloseText: { fontSize: 16, color: colors.textMuted },
});
