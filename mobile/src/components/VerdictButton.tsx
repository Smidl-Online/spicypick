import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

type Verdict = 'guilty' | 'not_guilty' | 'complicated' | 'both_wrong';

const VERDICT_CONFIG: Record<Verdict, { label: string; emoji: string; color: string }> = {
  guilty: { label: 'Guilty', emoji: '❌', color: colors.guilty },
  not_guilty: { label: 'Not Guilty', emoji: '✅', color: colors.notGuilty },
  complicated: { label: "It's Complicated", emoji: '🤔', color: colors.complicated },
  both_wrong: { label: 'Both Wrong', emoji: '⚡', color: colors.bothWrong },
};

type Props = {
  verdict: Verdict;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
};

export function VerdictButton({ verdict, onPress, disabled, selected }: Props) {
  const config = VERDICT_CONFIG[verdict];

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { borderColor: config.color },
        selected && { backgroundColor: config.color },
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={styles.emoji}>{config.emoji}</Text>
      <Text style={[styles.label, selected && styles.selectedLabel]}>{config.label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    marginVertical: 6,
    backgroundColor: colors.bgCard,
  },
  disabled: { opacity: 0.5 },
  emoji: { fontSize: 20, marginRight: 10 },
  label: { fontSize: 16, fontWeight: '600', color: colors.text },
  selectedLabel: { color: '#fff' },
});
