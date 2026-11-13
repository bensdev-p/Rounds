/**
 * The ladder, the app's signature element (DESIGN.md). Six square rungs,
 * bottom to top: passed = green, current = amber, missed = coral, not yet = dim.
 * The one moment of motion: a passed rung fills green from the bottom and the
 * next pops amber with a slight overshoot (280 ms). Reduce Motion skips both.
 */
import { RUNG_LABELS, RUNGS } from '@rounds/shared';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { motion, radius, size, type, useTheme } from '@/theme';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { Txt } from './Text';

export type RungState = 'dim' | 'now' | 'done' | 'miss';

const POP_EASING = Easing.bezier(0.2, 0.9, 0.3, 1.2);
const LABELS = RUNGS.map((r) => RUNG_LABELS[r]);

/** Rung states for a ladder `score` rungs up, with the next rung current or missed. */
export function rungStates(score: number, next: 'now' | 'miss' | 'none'): RungState[] {
  return LABELS.map((_, i) =>
    i < score ? 'done' : i === score && next !== 'none' ? next : 'dim',
  );
}

function describe(states: readonly RungState[]): string {
  const passed = states.filter((s) => s === 'done').length;
  const now = states.indexOf('now');
  const miss = states.indexOf('miss');
  if (miss >= 0) return `Ladder: ${passed} rungs climbed, missed on rung ${miss + 1}, ${LABELS[miss]}`;
  if (now >= 0) return `Ladder: rung ${now + 1} of 6, ${LABELS[now]}. ${passed} passed`;
  return `Ladder: ${passed} of 6 rungs climbed`;
}

function Rung({ n, state }: { n: number; state: RungState }) {
  const { c } = useTheme();
  const reduceMotion = useReduceMotion();
  const [fill] = useState(() => new Animated.Value(state === 'done' ? 1 : 0));
  const [scale] = useState(() => new Animated.Value(1));
  const previous = useRef(state);

  useEffect(() => {
    const was = previous.current;
    previous.current = state;
    if (state === 'done' && was !== 'done' && !reduceMotion) {
      fill.setValue(0);
      Animated.timing(fill, {
        toValue: 1,
        duration: motion.rungPassMs,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    } else {
      fill.setValue(state === 'done' ? 1 : 0);
    }
    if (state === 'now' && was === 'dim' && !reduceMotion) {
      scale.setValue(0.82);
      Animated.timing(scale, {
        toValue: 1,
        duration: motion.rungPassMs,
        easing: POP_EASING,
        useNativeDriver: true,
      }).start();
    }
  }, [state, reduceMotion, fill, scale]);

  const numeral = type('rungNumber', { tabular: true });
  const fillHeight = fill.interpolate({ inputRange: [0, 1], outputRange: [0, size.rung] });

  const face = (color: string, background?: string) => (
    <View style={[styles.face, background !== undefined && { backgroundColor: background }]}>
      <Txt style={[numeral, { color }]}>{n}</Txt>
    </View>
  );

  return (
    <Animated.View
      style={[styles.square, { backgroundColor: c.surface, transform: [{ scale }] }]}
    >
      {face(c.text3)}
      {state === 'now' && face(c.onSignal, c.signal)}
      {state === 'done' && (
        <Animated.View style={[styles.fill, { height: fillHeight, backgroundColor: c.bg }]}>
          <View style={[styles.fillInner, { backgroundColor: c.passSoft }]}>
            {face(c.pass)}
          </View>
        </Animated.View>
      )}
      {state === 'miss' && (
        <View style={[styles.face, { backgroundColor: c.bg }]}>{face(c.miss, c.missSoft)}</View>
      )}
    </Animated.View>
  );
}

const LABEL_TONE = { dim: 'text3', done: 'text2', now: 'text', miss: 'miss' } as const;

/** Six rungs with labels, bottom to top. `states[0]` is rung 1. */
export function Ladder({ states, width }: { states: readonly RungState[]; width?: number }) {
  return (
    <View
      accessible
      accessibilityLabel={describe(states)}
      style={[styles.ladder, width !== undefined && { width }]}
    >
      {LABELS.map((label, i) => {
        const state = states[i] ?? 'dim';
        return (
          <View key={label} style={styles.rungRow}>
            <Rung n={i + 1} state={state} />
            <Txt
              variant="small"
              tone={LABEL_TONE[state]}
              weight={state === 'now' || state === 'miss' ? 'bodySemi' : 'bodyMedium'}
              style={styles.label}
              numberOfLines={2}
            >
              {label}
            </Txt>
          </View>
        );
      })}
    </View>
  );
}

/** The ladder as a horizontal strip, for when the keyboard is up. */
export function LadderStrip({ states }: { states: readonly RungState[] }) {
  return (
    <View accessible accessibilityLabel={describe(states)} style={styles.strip}>
      {LABELS.map((label, i) => (
        <Rung key={label} n={i + 1} state={states[i] ?? 'dim'} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ladder: { flexDirection: 'column-reverse', gap: 6 },
  rungRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: size.rung },
  label: { flexShrink: 1 },
  strip: { flexDirection: 'row', gap: 6 },
  square: {
    width: size.rung,
    height: size.rung,
    borderRadius: radius.rung,
    overflow: 'hidden',
  },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  fillInner: { position: 'absolute', left: 0, right: 0, bottom: 0, height: size.rung },
});
