import { Pressable, StyleSheet, Text } from 'react-native';
import { space, useTheme } from '@/theme';

interface ButtonProps {
  label: string;
  /** Spoken by screen readers. Defaults to `label`. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}

export function Button({
  label,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  disabled = false,
  variant = 'primary',
}: ButtonProps) {
  const theme = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: primary ? theme.primary : 'transparent',
          borderColor: theme.primary,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text style={[styles.label, { color: primary ? theme.onPrimary : theme.primary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 17, fontWeight: '600' },
});
