import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/api/client';
import { useTheme } from '../../src/theme/ThemeContext';
import { useTranslation } from 'react-i18next';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { logout, user } = useAuthStore();

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
            Active
          </Text>
        )}
        <Text style={chevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={row} onPress={() => router.push('/scenario/archive')}>
        <Text style={styles.rowIcon}>📚</Text>
        <Text style={rowText}>{t('settings.archive')}</Text>
        <Text style={chevron}>›</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />

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
