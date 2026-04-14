import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../src/api/client';
import { useTheme } from '../../src/theme/ThemeContext';
import { useTranslation } from 'react-i18next';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email) return;
    try {
      await api('/api/auth/forgot-password', { method: 'POST', body: { email: email.trim() }, auth: false });
      setSent(true);
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message);
    }
  };

  if (sent) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.inner}>
          <Text style={styles.logo}>📧</Text>
          <Text style={[styles.title, { color: colors.text }]}>{t('auth.check_email')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('auth.reset_sent')}</Text>
          <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
            <Text style={styles.buttonText}>{t('auth.back_to_login')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.inner}>
        <Text style={[styles.title, { color: colors.text }]}>{t('auth.reset_password')}</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.bgCard, color: colors.text, borderColor: colors.border }]}
          placeholder={t('auth.email')}
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={handleSubmit}>
          <Text style={styles.buttonText}>{t('auth.send_reset_link')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={[styles.linkText, { color: colors.primary }]}>{t('auth.back_to_login')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  logo: { fontSize: 64, textAlign: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 32 },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  linkText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
