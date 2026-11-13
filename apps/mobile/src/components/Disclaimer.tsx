import { StyleSheet, Text } from 'react-native';
import { space, useTheme } from '@/theme';

export function Disclaimer() {
  const theme = useTheme();
  return (
    <Text style={[styles.text, { color: theme.muted }]}>
      Educational use only, not clinical guidance. Never enter patient details.
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 13, textAlign: 'center', marginTop: space.lg },
});
