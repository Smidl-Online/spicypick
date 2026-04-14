import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Switch, StyleSheet, ActivityIndicator, TouchableOpacity, Linking, Platform, AppState, AppStateStatus } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../src/theme/ThemeContext';
import { api } from '../../src/api/client';
import { getPushPermissionStatus } from '../../src/hooks/usePushNotifications';

type NotifPrefs = {
  daily: boolean;
  streak: boolean;
  league: boolean;
  challenges: boolean;
  achievements: boolean;
};

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [osPermission, setOsPermission] = useState<string>('undetermined');

  const checkPermission = useCallback(async () => {
    const status = await getPushPermissionStatus();
    setOsPermission(status);
  }, []);

  const loadPrefs = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    api<NotifPrefs>('/api/users/me/notification-preferences')
      .then(setPrefs)
      .catch(() => {
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadPrefs();
    checkPermission();

    // Re-check permission when returning from OS settings
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        checkPermission();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loadPrefs, checkPermission]);

  const toggle = useCallback((key: keyof NotifPrefs) => {
    if (!prefs || loadError) return;
    const newValue = !prefs[key];
    setPrefs({ ...prefs, [key]: newValue });
    api('/api/users/me/notification-preferences', {
      method: 'PATCH',
      body: { [key]: newValue },
    }).catch(() => {
      // Revert on failure
      setPrefs((prev) => prev ? { ...prev, [key]: !newValue } : prev);
    });
  }, [prefs, loadError]);

  const openSettings = useCallback(() => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, alignItems: 'center', paddingTop: 40 }]}>
        <Text style={{ color: colors.textSecondary, fontSize: 15, marginBottom: 16 }}>
          {t('notifications.load_error')}
        </Text>
        <TouchableOpacity onPress={loadPrefs} style={[styles.retryButton, { backgroundColor: colors.primary }]}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!prefs) return null;

  const permissionDenied = osPermission === 'denied';
  const permissionUnsupported = osPermission === 'unsupported';

  const rows: Array<{ key: keyof NotifPrefs; labelKey: string; emoji: string }> = [
    { key: 'daily', labelKey: 'notifications.daily', emoji: '\u2696\uFE0F' },
    { key: 'streak', labelKey: 'notifications.streak', emoji: '\uD83D\uDD25' },
    { key: 'league', labelKey: 'notifications.league', emoji: '\uD83C\uDFC6' },
    { key: 'challenges', labelKey: 'notifications.challenges', emoji: '\u2694\uFE0F' },
    { key: 'achievements', labelKey: 'notifications.achievements', emoji: '\uD83C\uDF96\uFE0F' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {permissionDenied && (
        <TouchableOpacity
          style={[styles.permissionBanner, { backgroundColor: colors.warning + '22' }]}
          onPress={openSettings}
        >
          <Text style={[styles.permissionText, { color: colors.warning }]}>
            {t('notifications.permission_denied')}
          </Text>
        </TouchableOpacity>
      )}
      {permissionUnsupported && (
        <View style={[styles.permissionBanner, { backgroundColor: colors.border }]}>
          <Text style={[styles.permissionText, { color: colors.textSecondary }]}>
            {t('notifications.permission_unsupported')}
          </Text>
        </View>
      )}
      {rows.map((row) => (
        <View key={row.key} style={[styles.row, { borderBottomColor: colors.border }]}>
          <Text style={styles.emoji}>{row.emoji}</Text>
          <Text style={[styles.label, { color: colors.text }]}>{t(row.labelKey)}</Text>
          <Switch
            value={prefs[row.key]}
            onValueChange={() => toggle(row.key)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
            disabled={permissionDenied || permissionUnsupported}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  emoji: { fontSize: 20, marginRight: 12 },
  label: { fontSize: 15, flex: 1 },
  retryButton: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  permissionBanner: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 8,
  },
  permissionText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
