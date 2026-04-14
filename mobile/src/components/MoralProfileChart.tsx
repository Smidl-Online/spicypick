import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { useTranslation } from 'react-i18next';

type Dimension = {
  key: string;
  value: number;
  color: string;
};

const DIMENSION_COLORS: Record<string, string> = {
  forgiving: '#4ade80',
  pragmatic: '#fbbf24',
  empathetic: '#60a5fa',
  confrontational: '#f87171',
  majorityAligned: '#a78bfa',
  consistent: '#34d399',
};

type Props = {
  profile: {
    forgiving: number;
    pragmatic: number;
    empathetic: number;
    confrontational: number;
    majorityAligned: number;
    consistent: number;
  };
};

export function MoralProfileChart({ profile }: Props) {
  const { t } = useTranslation();

  const dimensions: Dimension[] = [
    { key: 'forgiving', value: profile.forgiving, color: DIMENSION_COLORS.forgiving },
    { key: 'pragmatic', value: profile.pragmatic, color: DIMENSION_COLORS.pragmatic },
    { key: 'empathetic', value: profile.empathetic, color: DIMENSION_COLORS.empathetic },
    { key: 'confrontational', value: profile.confrontational, color: DIMENSION_COLORS.confrontational },
    { key: 'majorityAligned', value: profile.majorityAligned, color: DIMENSION_COLORS.majorityAligned },
    { key: 'consistent', value: profile.consistent, color: DIMENSION_COLORS.consistent },
  ];

  return (
    <View style={styles.container}>
      {dimensions.map((dim) => (
        <View key={dim.key} style={styles.row}>
          <View style={styles.labelContainer}>
            <Text style={styles.label} numberOfLines={1}>
              {t(`moralProfile.dimensions.${dim.key}`)}
            </Text>
            <Text style={[styles.value, { color: dim.color }]}>{dim.value}%</Text>
          </View>
          <View style={styles.barBg}>
            <View
              style={[
                styles.barFill,
                { width: `${dim.value}%`, backgroundColor: dim.color },
              ]}
            />
          </View>
          <Text style={styles.description} numberOfLines={1}>
            {t(`moralProfile.descriptions.${dim.key}`)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  row: {
    gap: 4,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  value: {
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },
  barBg: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  description: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
