import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, FlatList } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/api/client';
import { useTheme } from '../../src/theme/ThemeContext';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, saveLocale } from '../../src/i18n';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { logout, user } = useAuthStore();
  const [langPickerVisible, setLangPickerVisible] = useState(false);

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) || SUPPORTED_LANGUAGES[0];

  const changeLanguage = async (code: string) => {
    const previousLang = i18n.language;
    await i18n.changeLanguage(code);
    setLangPickerVisible(false);
    try {
      await saveLocale(code);
      await api('/api/users/me', { method: 'PATCH', body: { locale: code } });
    } catch (err) {
      console.warn('Failed to persist locale:', err);
      await i18n.changeLanguage(previousLang);
      await saveLocale(previousLang);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('settings.delete_account'),
      t('settings.delete_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api('/api/auth/account', { method: 'DELETE' });
              await logout();
            } catch (err: any) {
              Alert.alert(t('common.error'), err.message);
            }
          },
        },
      ],
    );
  };

  const row = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  };
  const rowText = { fontSize: 16, color: colors.text, flex: 1 };
  const chevron = { fontSize: 20, color: colors.textMuted };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 8 }}>
      <TouchableOpacity style={row} onPress={() => router.push('/settings/notifications')}>
        <Text style={styles.rowIcon}>🔔</Text>
        <Text style={rowText}>{t('settings.notifications')}</Text>
        <Text style={chevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={row} onPress={() => router.push('/settings/premium')}>
        <Text style={styles.rowIcon}>👑</Text>
        <Text style={rowText}>{t('settings.premium')}</Text>
        {user?.isPremium && (
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent, backgroundColor: colors.bgCard, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginRight: 8 }}>
            {t('settings.premium_active')}
          </Text>
        )}
        <Text style={chevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={row} onPress={() => setLangPickerVisible(true)}>
        <Text style={styles.rowIcon}>🌐</Text>
        <Text style={rowText}>{t('settings.language')}</Text>
        <Text style={{ fontSize: 14, color: colors.textMuted, marginRight: 8 }}>{currentLang.name}</Text>
        <Text style={chevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={row} onPress={() => router.push('/scenario/archive')}>
        <Text style={styles.rowIcon}>📚</Text>
        <Text style={rowText}>{t('settings.archive')}</Text>
        <Text style={chevron}>›</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />

      <Modal visible={langPickerVisible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, maxHeight: '60%' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>{t('settings.language')}</Text>
            <FlatList
              data={SUPPORTED_LANGUAGES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.border }, item.code === i18n.language && { backgroundColor: colors.primary + '15' }]}
                  onPress={() => changeLanguage(item.code)}
                >
                  <Text style={[{ fontSize: 16, color: colors.text, flex: 1 }, item.code === i18n.language && { fontWeight: '700', color: colors.primary }]}>
                    {item.name}
                  </Text>
                  {item.code === i18n.language && <Text style={{ fontSize: 18, color: colors.primary, fontWeight: '700' }}>✓</Text>}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={{ paddingVertical: 16, alignItems: 'center' }} onPress={() => setLangPickerVisible(false)}>
              <Text style={{ fontSize: 16, color: colors.textMuted }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <TouchableOpacity style={row} onPress={logout}>
        <Text style={styles.rowIcon}>🚪</Text>
        <Text style={[rowText, { color: colors.warning }]}>{t('settings.logout')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={row} onPress={handleDeleteAccount}>
        <Text style={styles.rowIcon}>⚠️</Text>
        <Text style={[rowText, { color: colors.error }]}>{t('settings.delete_account')}</Text>
      </TouchableOpacity>

      <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 32 }}>SpicyPick v1.0.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rowIcon: { fontSize: 20, marginRight: 12 },
});
