import type { ColorToken } from '@rounds/shared/theme';
import type { ComponentType, ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, size, space, useTheme } from '@/theme';
import { Txt } from './Text';

/** Any icon that takes size and color: lucide icons and LadderIcon. */
export type IconComponent = ComponentType<{ size?: number; color: string }>;

interface ButtonProps {
  label: string;
  onPress: () => void;
  /** primary = amber (one per screen), quiet = surface2, line = outlined. */
  variant?: 'primary' | 'quiet' | 'line';
  /** The 60 pt Home hero button. */
  hero?: boolean;
  icon?: IconComponent;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string | undefined;
  style?: StyleProp<ViewStyle>;
  /** A secondary action on long press, also offered to screen readers under this label. */
  longPress?: { label: string; onPress: () => void };
}

/** Button. Labels are plain verbs ("Go again"), icon on the left, never an arrow. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  hero = false,
  icon: Icon,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  style,
  longPress,
}: ButtonProps) {
  const { c } = useTheme();
  const fg: ColorToken = variant === 'primary' ? 'onSignal' : 'text';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onLongPress={longPress?.onPress}
      accessibilityActions={longPress ? [{ name: 'longpress', label: longPress.label }] : undefined}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'longpress') longPress?.onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        { height: hero ? size.heroButtonHeight : size.buttonHeight },
        variant === 'primary' && { backgroundColor: c.signal },
        variant === 'quiet' && { backgroundColor: c.surface2 },
        variant === 'line' && { borderWidth: 1.5, borderColor: c.line },
        { opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {Icon && <Icon size={hero ? 22 : 20} color={c[fg]} />}
      <Txt
        variant="body"
        weight="bodySemi"
        tone={fg}
        fontSize={hero ? 18 : 16}
        numberOfLines={1}
        style={styles.label}
      >
        {label}
      </Txt>
    </Pressable>
  );
}

/** Round 44 pt icon button, e.g. the close button on session screens. */
export function IconButton({
  icon: Icon,
  label,
  onPress,
}: {
  icon: IconComponent;
  label: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      // 36 pt circle as drawn; the hit slop brings the touch target to 44 pt.
      hitSlop={4}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Icon size={18} color={c.text} />
    </Pressable>
  );
}

/** Text link in ceil blue. */
export function Link({
  label,
  onPress,
  accessibilityHint,
  icon: Icon,
  back = false,
}: {
  label: string;
  onPress: () => void;
  accessibilityHint?: string | undefined;
  icon?: IconComponent;
  /** The "‹ Previous screen" link at the top of pushed screens: 15 pt with a 20 pt icon. */
  back?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      style={({ pressed }) => [styles.link, back && styles.backLink, { opacity: pressed ? 0.7 : 1 }]}
    >
      {Icon && <Icon size={back ? 20 : 18} color={c.ceil} />}
      <Txt
        variant="meta"
        weight={back ? 'body' : 'bodyMedium'}
        tone="ceil"
        {...(back ? { fontSize: 15 } : null)}
      >
        {label}
      </Txt>
    </Pressable>
  );
}

/** Segmented control (persona picker). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  onPanel = false,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** What the group chooses, for screen readers. */
  label: string;
  /** Inside a surface panel (Home hero): the track uses bg instead of surface. */
  onPanel?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.segmented, { backgroundColor: onPanel ? c.bg : c.surface }]}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked: on }}
            onPress={() => onChange(o.value)}
            hitSlop={{ top: 4, bottom: 4 }}
            style={[styles.segment, on && { backgroundColor: c.surface2 }]}
          >
            <Txt variant="meta" weight="bodyMedium" tone={on ? 'text' : 'text2'}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Small round chip (rotations, confused-with links). */
export function Chip({
  label,
  onPress,
  tone = 'neutral',
  accessibilityHint,
}: {
  label: string;
  onPress?: () => void;
  tone?: 'neutral' | 'miss';
  accessibilityHint?: string | undefined;
}) {
  const { c } = useTheme();
  const content = (
    <Txt variant="small" weight="bodyMedium">
      {label}
    </Txt>
  );
  const style = [styles.chip, { backgroundColor: tone === 'miss' ? c.missSoft : c.surface2 }];
  if (!onPress) return <View style={style}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      // 30 pt chip, 44 pt touch target.
      hitSlop={{ top: 7, bottom: 7 }}
      style={({ pressed }) => [style, { opacity: pressed ? 0.8 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

/** A grouped list: one surface block with hairline dividers, not a stack of cards. */
export function List({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  return <View style={[styles.list, { backgroundColor: c.surface }]}>{children}</View>;
}

export function Row({
  title,
  subtitle,
  trailing,
  first = false,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  /** The first row has no divider above it. */
  first?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string | undefined;
}) {
  const { c } = useTheme();
  const body = (
    <>
      <View style={styles.grow}>
        <Txt variant="body" weight="bodyMedium" fontSize={17} lineHeight={23}>
          {title}
        </Txt>
        {subtitle ? <Txt variant="small" tone="text2">{subtitle}</Txt> : null}
      </View>
      {trailing}
    </>
  );
  const style = [styles.row, !first && { borderTopWidth: 1, borderTopColor: c.line }];
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [style, pressed && { backgroundColor: c.surface2 }]}
    >
      {body}
    </Pressable>
  );
}

/** A panel: surface block for grouped content (hero 28, panel 24, list 18). */
export function Panel({
  children,
  level = 'list',
  style,
}: {
  children: ReactNode;
  level?: 'hero' | 'panel' | 'list';
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  return (
    <View
      style={[
        { backgroundColor: c.surface, borderRadius: radius[level], padding: level === 'hero' ? space.xl : space.lg },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: space.xl,
    minWidth: size.minTouch,
  },
  label: { flexShrink: 1 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 24 },
  backLink: { gap: 6 },
  segmented: { flexDirection: 'row', borderRadius: radius.row, padding: 4 },
  segment: {
    flex: 1,
    // 37 pt as drawn; the hit slop brings the touch target to 44 pt.
    minHeight: 37,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: radius.chip,
    justifyContent: 'center',
  },
  list: { borderRadius: radius.list, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    minHeight: 64,
  },
  grow: { flex: 1, minWidth: 0, gap: 2 },
});
