import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/api/client';
import { colors } from '../../src/theme/colors';
import { useTranslation } from 'react-i18next';

export default function SettingsScreen() {
  const { t } = useTranslation();
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

      <TouchableOpacity style={styles.row} onPress={() => router.push('/scenario/archive')}>
        <Text style={styles.rowIcon}>📚</Text>
        <Text style={styles.rowText}>Scenario Archive</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <View style={styles.spacer} />

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
  spacer: { height: 32 },
  version: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 32 },
});
