import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { space, useTheme } from '@/theme';

/**
 * A full screen on `bg` with the 20 pt margin. `footer` stays pinned in the
 * thumb zone (session screens); `scroll` lets the body scroll above it.
 */
export function Screen({
  children,
  footer,
  scroll = true,
  contentStyle,
}: {
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.flex, { backgroundColor: c.bg }]}>
      <View style={styles.column}>
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.content, contentStyle]}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, styles.content, contentStyle]}>{children}</View>
        )}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Phone-width column, centred on wide web windows.
  column: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  content: { paddingHorizontal: space.screenX, paddingTop: space.md, paddingBottom: space.xxl },
  footer: { paddingHorizontal: space.screenX, paddingTop: space.md, paddingBottom: space.lg },
});
