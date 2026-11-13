import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { space, useTheme } from '@/theme';
import { Button } from '@/ui/controls';
import { Txt } from '@/ui/Text';

/** Full-screen loading spinner with a label screen readers announce. */
export function Loading({ label }: { label: string }) {
  const { c } = useTheme();
  return (
    <View
      style={[styles.center, { backgroundColor: c.bg }]}
      accessible
      accessibilityLabel={label}
      accessibilityRole="progressbar"
    >
      <ActivityIndicator color={c.text2} />
      <Txt variant="meta" tone="text2" align="center">
        {label}
      </Txt>
    </View>
  );
}

/** Full-screen error that says what went wrong, with an optional retry. */
export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { c } = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: c.bg }]}>
      <Txt accessibilityRole="alert" align="center">
        {message}
      </Txt>
      {onRetry && <Button label="Try again" variant="quiet" onPress={onRetry} />}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xxl,
    gap: space.lg,
  },
});
