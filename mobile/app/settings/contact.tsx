import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeContext';
import { useTranslation } from 'react-i18next';
import { api } from '../../src/api/client';

export default function ContactSupportScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert(t('common.error'), t('support.fill_all_fields'));
      return;
    }

    setLoading(true);
    try {
      await api('/api/support/contact', {
        method: 'POST',
        body: { subject: subject.trim(), message: message.trim() },
      });
      Alert.alert(t('support.success_title'), t('support.success_message'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    } catch (err: any) {
      const msg = err?.message || t('support.error_message');
      Alert.alert(t('common.error'), msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={[styles.label, { color: colors.textMuted }]}>{t('support.subject_label')}</Text>
      <TextInput
        testID="subject-input"
        style={[styles.input, { backgroundColor: colors.bgCard, color: colors.text, borderColor: colors.border }]}
        value={subject}
        onChangeText={setSubject}
        placeholder={t('support.subject_placeholder')}
        placeholderTextColor={colors.textMuted}
        maxLength={200}
        editable={!loading}
      />

      <Text style={[styles.label, { color: colors.textMuted }]}>{t('support.message_label')}</Text>
      <TextInput
        testID="message-input"
        style={[styles.textarea, { backgroundColor: colors.bgCard, color: colors.text, borderColor: colors.border }]}
        value={message}
        onChangeText={setMessage}
        placeholder={t('support.message_placeholder')}
        placeholderTextColor={colors.textMuted}
        multiline
        numberOfLines={8}
        maxLength={2000}
        editable={!loading}
        textAlignVertical="top"
      />

      <Text style={[styles.charCount, { color: colors.textMuted }]}>{message.length}/2000</Text>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: loading ? colors.textMuted : colors.primary }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? t('support.sending') : t('support.send_button')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 160,
    marginBottom: 4,
  },
  charCount: { fontSize: 12, textAlign: 'right', marginBottom: 24 },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
