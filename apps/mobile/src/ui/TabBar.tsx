import type { BottomTabBarProps } from 'expo-router/tabs';
import { Book, ClipboardPlus, User } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';
import type { IconComponent } from './controls';
import { LadderIcon } from './icons';
import { Txt } from './Text';

/** Icon per tab route, as drawn on the tab screens' mockups. */
const ICONS: Record<string, IconComponent> = {
  '(pimp)': LadderIcon,
  log: ClipboardPlus,
  review: Book,
  profile: User,
};

/**
 * The tab bar (mockups/rounds.css → .tabs): four equal columns, hairline top
 * border, 24 pt icon over an 11 pt label. Inactive tabs are text3; the active
 * tab's label is text and its icon is signal.
 */
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { c } = useTheme();
  return (
    <View
      style={[
        styles.bar,
        // 26 pt under the labels on a phone with a home indicator, as drawn.
        {
          backgroundColor: c.bg,
          borderTopColor: c.line,
          paddingBottom: Math.max(insets.bottom - 8, 8),
        },
      ]}
    >
      <View accessibilityRole="tablist" style={styles.row}>
        {state.routes.map((route, index) => {
          const focused = index === state.index;
          const title = descriptors[route.key]?.options.title ?? route.name;
          const Icon = ICONS[route.name];
          const onPress = () => {
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={title}
              accessibilityState={{ selected: focused }}
              onPress={onPress}
              style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.7 : 1 }]}
            >
              {Icon && <Icon size={24} color={focused ? c.signal : c.text3} />}
              <Txt
                variant="small"
                weight="bodyMedium"
                tone={focused ? 'text' : 'text3'}
                fontSize={11}
                lineHeight={14}
                maxFontSizeMultiplier={1.4}
                numberOfLines={1}
              >
                {title}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: 1, paddingTop: 8, paddingHorizontal: 8 },
  // Phone-width row, centred on wide web windows (matches Screen's column).
  row: { flexDirection: 'row', width: '100%', maxWidth: 480, alignSelf: 'center' },
  tab: { flex: 1, alignItems: 'center', gap: 4, minHeight: 44, justifyContent: 'center' },
});
