import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useGuildStore } from '../../src/store/guildStore';
import { useTheme } from '../../src/theme/ThemeContext';
import { useTranslation } from 'react-i18next';

export default function CreateGuildScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { createGuild, isActing, error, clearError } = useGuildStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (error) {
      Alert.alert(t('common.error'), error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error]);

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 50) return;

    const success = await createGuild(trimmedName, description.trim() || undefined);
    if (success) {
      router.replace('/guild/my-guild');
    }
  };

  const isValid = name.trim().length >= 2 && name.trim().length <= 50;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.content}>
          {/* Back */}
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backText, { color: colors.primary }]}>{'\u{2190}'} {t('common.cancel')}</Text>
          </TouchableOpacity>

          <Text style={[styles.title, { color: colors.text }]}>{t('guild.create')}</Text>

          {/* Name input */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('guild.create_name')}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.bgCard, color: colors.text, borderColor: colors.border }]}
            value={name}
            onChangeText={setName}
            placeholder={t('guild.create_name_placeholder')}
            placeholderTextColor={colors.textMuted}
            maxLength={50}
            autoFocus
          />
          <Text style={[styles.charCount, { color: colors.textMuted }]}>{name.trim().length}/50</Text>

          {/* Description input */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('guild.create_description')}</Text>
          <TextInput
            style={[styles.input, styles.multilineInput, { backgroundColor: colors.bgCard, color: colors.text, borderColor: colors.border }]}
            value={description}
            onChangeText={setDescription}
            placeholder={t('guild.create_description_placeholder')}
            placeholderTextColor={colors.textMuted}
            maxLength={500}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Create button */}
          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: isValid ? colors.primary : colors.bgLight }]}
            onPress={handleCreate}
            disabled={!isValid || isActing}
          >
            {isActing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={[styles.createBtnText, { opacity: isValid ? 1 : 0.5 }]}>{t('guild.create_submit')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16 },
  backBtn: { paddingVertical: 12 },
  backText: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
  },
  multilineInput: {
    minHeight: 100,
    paddingTop: 14,
  },
  charCount: { fontSize: 11, textAlign: 'right', marginTop: 4, marginBottom: 16 },
  createBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
