import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ScrollView,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from 'react-i18next';
import { saveConsent, type ConsentLevel } from '../services/consent';

const PRIVACY_URL = 'https://spicypick.app/privacy';

type Props = {
  visible: boolean;
  onResolved: (level: ConsentLevel) => void;
};

export function GdprConsentBanner({ visible, onResolved }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [submitting, setSubmitting] = React.useState(false);
  const [saveError, setSaveError] = React.useState(false);

  const choose = async (level: ConsentLevel) => {
    if (submitting) return;
    setSubmitting(true);
    setSaveError(false);
    try {
      await saveConsent(level);
      onResolved(level);
    } catch {
      setSaveError(true);
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {}}
      testID="gdpr-consent-banner"
    >
      <View style={styles.backdrop}>
        <View
          style={[styles.sheet, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
        >
          <Text style={[styles.title, { color: colors.text }]}>{t('gdpr.title')}</Text>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
            <Text style={[styles.body, { color: colors.text }]}>{t('gdpr.body')}</Text>
            <Text style={[styles.bodyMuted, { color: colors.textMuted }]}>
              {t('gdpr.bodyMuted')}
            </Text>
          </ScrollView>

          <TouchableOpacity
            onPress={() => Linking.openURL(PRIVACY_URL)}
            testID="gdpr-privacy-link"
            accessibilityRole="link"
          >
            <Text style={[styles.link, { color: colors.primary }]}>{t('gdpr.privacy_link')}</Text>
          </TouchableOpacity>

          {saveError && (
            <Text style={[styles.errorText, { color: colors.error ?? '#EF4444' }]}>
              {t('common.error')}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={() => choose('all')}
            disabled={submitting}
            testID="gdpr-accept-all"
          >
            <Text style={styles.primaryBtnText}>{t('gdpr.accept_all')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: colors.border }]}
            onPress={() => choose('essential')}
            disabled={submitting}
            testID="gdpr-essential-only"
          >
            <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
              {t('gdpr.essential_only')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    maxHeight: '75%',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  bodyScroll: {
    maxHeight: 220,
  },
  bodyContent: {
    paddingBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  bodyMuted: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 12,
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
});
