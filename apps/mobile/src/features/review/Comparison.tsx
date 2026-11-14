/**
 * The mix-up comparison (DESIGN.md → Components → Comparison, review.png): two
 * columns, the same keys on both sides. The columns slide 40 px together from
 * the left and right and fade in (video scene 7); Reduce Motion shows them at
 * once. Without comparison rows it falls back to the script's own "how to tell
 * apart" sentence.
 */
import type { ComparisonRow } from '@rounds/shared';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { radius, space, useTheme } from '@/theme';
import { Panel } from '@/ui/controls';
import { Txt } from '@/ui/Text';

const SLIDE_PX = 40;
const SLIDE_MS = 300;

function Column({
  name,
  rows,
  side,
  progress,
}: {
  name: string;
  rows: readonly { label: string; text: string }[];
  side: 'left' | 'right';
  progress: Animated.Value;
}) {
  const { c } = useTheme();
  const left = side === 'left';
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [left ? -SLIDE_PX : SLIDE_PX, 0],
  });
  return (
    <Animated.View
      accessible
      accessibilityLabel={`${name}. ${rows.map((r) => `${r.label}: ${r.text}`).join('. ')}`}
      style={[
        styles.column,
        left
          ? { borderTopLeftRadius: radius.list, borderBottomLeftRadius: radius.list }
          : {
              borderTopRightRadius: radius.list,
              borderBottomRightRadius: radius.list,
              borderLeftWidth: 1,
              borderLeftColor: c.line,
            },
        { backgroundColor: c.surface, opacity: progress, transform: [{ translateX }] },
      ]}
    >
      <Txt variant="h2" fontSize={19} lineHeight={22}>
        {name}
      </Txt>
      {rows.map((row) => (
        <View key={row.label}>
          <Txt variant="small" tone="text3" fontSize={12} lineHeight={17} style={styles.key}>
            {row.label}
          </Txt>
          <Txt variant="body" weight="bodyMedium" fontSize={14} lineHeight={19}>
            {row.text}
          </Txt>
        </View>
      ))}
    </Animated.View>
  );
}

export function Comparison({
  leftName,
  rightName,
  rows,
  fallback,
}: {
  leftName: string;
  rightName: string;
  rows: readonly ComparisonRow[] | null;
  /** The script's "how to tell apart" note, shown when there are no rows. */
  fallback: string | null;
}) {
  const reduceMotion = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress, reduceMotion]);

  if (!rows) {
    return (
      <Panel style={styles.fallback}>
        <Txt variant="small" tone="text2">
          {`${leftName} or ${rightName}`}
        </Txt>
        {fallback ? <Txt variant="body">{fallback}</Txt> : null}
      </Panel>
    );
  }
  return (
    <View style={styles.pair}>
      <Column
        name={leftName}
        side="left"
        progress={progress}
        rows={rows.map((r) => ({ label: r.label, text: r.left.text }))}
      />
      <Column
        name={rightName}
        side="right"
        progress={progress}
        rows={rows.map((r) => ({ label: r.label, text: r.right.text }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row' },
  column: { flex: 1, paddingVertical: 14, paddingHorizontal: space.lg },
  key: { marginTop: 10 },
  fallback: { gap: 6 },
});
