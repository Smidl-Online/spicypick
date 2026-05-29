import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../src/theme/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
  loadConsent,
  saveConsent,
  type ConsentLevel,
  type ConsentState,
} from '../../src/services/consent';

const PRIVACY_URL = 'https://spicypick.app/privacy';

export default function PrivacyScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConsent().then((c) => {
      setConsent(c);
      setLoading(false);
    });
  }, []);

  const choose = async (level: ConsentLevel) => {
    if (saving) return;
    setSaving(true);
    try {
      const next = await saveConsent(level);
      setConsent(next);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const active: ConsentLevel = consent?.level ?? 'essential';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
      testID="privacy-screen"
    >
      <Text style={[styles.title, { color: colors.text }]}>{t('gdpr.preferences_title')}</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>
        {t('gdpr.preferences_body')}
      </Text>

      <TouchableOpacity
        style={[
          styles.option,
          { borderColor: colors.border, backgroundColor: colors.bgCard },
          active === 'all' && { borderColor: colors.primary },
        ]}
        onPress={() => choose('all')}
        disabled={saving}
        testID="privacy-option-all"
      >
        <Text style={[styles.optionTitle, { color: colors.text }]}>{t('gdpr.accept_all')}</Text>
        <Text style={[styles.optionDesc, { color: colors.textMuted }]}>
          {t('gdpr.accept_all_desc')}
        </Text>
        {active === 'all' && (
          <Text style={[styles.activeBadge, { color: colors.primary }]}>
            ✓ {t('gdpr.active')}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.option,
          { borderColor: colors.border, backgroundColor: colors.bgCard },
          active === 'essential' && { borderColor: colors.primary },
        ]}
        onPress={() => choose('essential')}
        disabled={saving}
        testID="privacy-option-essential"
      >
        <Text style={[styles.optionTitle, { color: colors.text }]}>{t('gdpr.essential_only')}</Text>
        <Text style={[styles.optionDesc, { color: colors.textMuted }]}>
          {t('gdpr.essential_only_desc')}
        </Text>
        {active === 'essential' && (
          <Text style={[styles.activeBadge, { color: colors.primary }]}>
            ✓ {t('gdpr.active')}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => Linking.openURL(PRIVACY_URL)}
        testID="privacy-link"
        accessibilityRole="link"
      >
        <Text style={[styles.link, { color: colors.primary }]}>{t('gdpr.privacy_link')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  option: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  optionDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  activeBadge: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
    paddingVertical: 12,
  },
});
