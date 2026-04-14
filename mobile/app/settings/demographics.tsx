import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/api/client';
import { useTheme } from '../../src/theme/ThemeContext';
import { useTranslation } from 'react-i18next';

const GENDER_OPTIONS = ['male', 'female', 'non_binary', 'prefer_not_to_say'] as const;

const YEAR_MIN = 1920;

export default function DemographicsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { user, fetchProfile } = useAuthStore();

  const [birthYear, setBirthYear] = useState<string>(user?.birthYear?.toString() ?? '');
  const [country, setCountry] = useState<string>(user?.country ?? '');
  const [gender, setGender] = useState<string | null>(user?.gender ?? null);
  const [saving, setSaving] = useState(false);

  const currentYear = new Date().getFullYear();

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      const parsedYear = parseInt(birthYear);
      if (birthYear && !isNaN(parsedYear) && parsedYear >= YEAR_MIN && parsedYear <= currentYear - 13) {
        body.birthYear = parsedYear;
      } else if (!birthYear) {
        body.birthYear = null;
      }

      if (country && /^[A-Z]{2}$/.test(country.toUpperCase())) {
        body.country = country.toUpperCase();
      } else if (!country) {
        body.country = null;
      }

      body.gender = gender;

      await api('/api/users/me', { method: 'PATCH', body });
      await fetchProfile();
      router.back();
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      t('demographics.deleteTitle'),
      t('demographics.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api('/api/users/me/demographics', { method: 'DELETE' });
              setBirthYear('');
              setCountry('');
              setGender(null);
              await fetchProfile();
            } catch (err: any) {
              Alert.alert(t('common.error'), err.message);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>{t('demographics.title')}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('demographics.subtitle')}</Text>

      {/* Birth Year */}
      <Text style={[styles.label, { color: colors.text }]}>{t('demographics.birthYear')}</Text>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bgCard }]}
        value={birthYear}
        onChangeText={setBirthYear}
        keyboardType="number-pad"
        maxLength={4}
        placeholder={t('demographics.birthYearPlaceholder')}
        placeholderTextColor={colors.textMuted}
      />

      {/* Country */}
      <Text style={[styles.label, { color: colors.text }]}>{t('demographics.country')}</Text>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bgCard }]}
        value={country}
        onChangeText={(text) => setCountry(text.toUpperCase())}
        maxLength={2}
        autoCapitalize="characters"
        placeholder={t('demographics.countryPlaceholder')}
        placeholderTextColor={colors.textMuted}
      />

      {/* Gender */}
      <Text style={[styles.label, { color: colors.text }]}>{t('demographics.gender')}</Text>
      <View style={styles.genderRow}>
        {GENDER_OPTIONS.map(g => (
          <TouchableOpacity
            key={g}
            onPress={() => setGender(gender === g ? null : g)}
            style={[
              styles.genderOption,
              { borderColor: colors.border, backgroundColor: colors.bgCard },
              gender === g && { borderColor: colors.primary, backgroundColor: colors.primary + '20' },
            ]}
          >
            <Text style={[
              styles.genderText,
              { color: colors.textSecondary },
              gender === g && { color: colors.primary, fontWeight: '700' },
            ]}>
              {t(`demographics.genders.${g}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: colors.primary }]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>{saving ? t('common.loading') : t('common.save')}</Text>
      </TouchableOpacity>

      {(user?.birthYear || user?.country || user?.gender) && (
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={[styles.deleteBtnText, { color: colors.error }]}>{t('demographics.deleteData')}</Text>
        </TouchableOpacity>
      )}

      <Text style={[styles.privacy, { color: colors.textMuted }]}>{t('demographics.privacyNote')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 24 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  genderRow: { gap: 8 },
  genderOption: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 0,
  },
  genderText: { fontSize: 15, textAlign: 'center' },
  saveBtn: {
    marginTop: 32,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  deleteBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  deleteBtnText: { fontSize: 14, fontWeight: '600' },
  privacy: { fontSize: 12, textAlign: 'center', marginTop: 24, lineHeight: 18 },
});
