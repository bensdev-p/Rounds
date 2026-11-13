import { TriangleAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { radius, space, useTheme } from '@/theme';
import { Txt } from './Text';

/** Warning block under a field: says exactly what to remove. */
export function PhiWarning({ message }: { message: string }) {
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.warn, { backgroundColor: c.missSoft }]}
    >
      <TriangleAlert size={18} color={c.miss} />
      <Txt variant="meta" style={styles.text}>
        {message}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  warn: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: space.md,
    paddingHorizontal: 14,
    borderRadius: radius.field,
    marginTop: space.sm,
  },
  text: { flex: 1 },
});
