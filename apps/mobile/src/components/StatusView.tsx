import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { space, useTheme } from '@/theme';

/** Full-screen loading spinner with a label screen readers announce. */
export function Loading({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View
      style={styles.center}
      accessible
      accessibilityLabel={label}
      accessibilityRole="progressbar"
    >
      <ActivityIndicator color={theme.primary} />
      <Text style={[styles.text, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

/** Full-screen error with an optional retry. */
export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <Text accessibilityRole="alert" style={[styles.text, { color: theme.danger }]}>
        {message}
      </Text>
      {onRetry && <Button label="Try again" onPress={onRetry} />}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
    gap: space.md,
  },
  text: { fontSize: 16, textAlign: 'center' },
});
