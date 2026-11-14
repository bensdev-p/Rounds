/** Progression pieces (DESIGN.md → Components). Amber = progress, green = passed, coral = missed. */
import { RANKS, type Badge as BadgeId, type ShiftDay } from '@rounds/shared';
import { Check, CircleMinus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { radius, space, useTheme } from '@/theme';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { LadderIcon } from './icons';
import { Txt } from './Text';

/** Today's rounds: one 6 pt segment per session in the goal. Fills without animation. */
export function Segments({ filled, total }: { filled: number; total: number }) {
  const { c } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${Math.min(filled, total)} of ${total} ${total === 1 ? 'session' : 'sessions'} done today`}
      style={styles.segments}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[styles.segment, { backgroundColor: i < filled ? c.signal : c.surface2 }]}
        />
      ))}
    </View>
  );
}

/** 8 pt progress bar. */
export function Bar({ value, label }: { value: number; label: string }) {
  const { c } = useTheme();
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={[styles.bar, { backgroundColor: c.surface2 }]}
    >
      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: c.signal }]} />
    </View>
  );
}

/** Mini ladder: six stacked 3 pt bars, best rung filled green. */
export function MiniLadder({ best, mastered = false }: { best: number; mastered?: boolean }) {
  const { c } = useTheme();
  const fill = mastered ? c.signal : c.pass;
  return (
    <View style={styles.mini}>
      {Array.from({ length: 6 }, (_, i) => (
        <View key={i} style={[styles.miniBar, { backgroundColor: i < best ? fill : c.surface2 }]} />
      ))}
    </View>
  );
}

/** A token colour at a lower opacity, e.g. the shifts grid's lighter blues. */
function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * The shifts grid (Profile): one square per day, oldest first, 14 per row.
 * Ceil blue is history; darker means more sessions. Post-call days are outlined.
 */
export function ShiftGrid({
  days,
  label,
}: {
  days: readonly ShiftDay[];
  /** Spoken summary, e.g. "Shifts, last 28 days: 12 in a row". */
  label: string;
}) {
  const { c } = useTheme();
  const fills = [c.surface2, withAlpha(c.ceil, 0.28), withAlpha(c.ceil, 0.55), c.ceil];
  const rows: ShiftDay[][] = [];
  for (let i = 0; i < days.length; i += 14) rows.push(days.slice(i, i + 14));
  return (
    <View accessible accessibilityLabel={label} style={styles.grid}>
      {rows.map((row) => (
        <View key={row[0]?.day} style={styles.gridRow}>
          {row.map((d) => (
            <View
              key={d.day}
              style={[
                styles.gridCell,
                d.postCall
                  ? { borderWidth: 1.5, borderColor: c.text3 }
                  : { backgroundColor: fills[d.level] },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/** Mastered-by-rotation bars. The weakest rotation is coral when there's more than one. */
export function RotationBars({
  rows,
}: {
  rows: readonly { name: string; mastered: number; total: number }[];
}) {
  const { c } = useTheme();
  const share = (r: { mastered: number; total: number }) => (r.total ? r.mastered / r.total : 0);
  const weakest =
    rows.length > 1 ? rows.reduce((low, r) => (share(r) < share(low) ? r : low)) : null;
  return (
    <View style={styles.rotations}>
      {rows.map((r) => (
        <View
          key={r.name}
          accessible
          accessibilityLabel={`${r.name}: ${r.mastered} of ${r.total} mastered`}
          style={styles.rotationRow}
        >
          <Txt variant="body" fontSize={17} style={styles.rotationName} numberOfLines={1}>
            {r.name}
          </Txt>
          <View style={[styles.rotationBar, { backgroundColor: c.surface2 }]}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${share(r) * 100}%`,
                  minWidth: r.mastered > 0 ? 8 : 0,
                  backgroundColor: r === weakest ? c.miss : c.signal,
                },
              ]}
            />
          </View>
          <Txt variant="h2" fontSize={20} tabular style={styles.rotationCount}>
            {r.mastered}/{r.total}
          </Txt>
        </View>
      ))}
    </View>
  );
}

const BADGES: Record<BadgeId, { label: string; tone: 'pass' | 'signal' }> = {
  clean_run: { label: 'Clean run', tone: 'pass' },
  script_mastered: { label: 'Script mastered', tone: 'signal' },
  new_best: { label: 'New best', tone: 'pass' },
};

export function Badge({ id }: { id: BadgeId }) {
  const { c } = useTheme();
  const { label, tone } = BADGES[id];
  const color = tone === 'pass' ? c.pass : c.signal;
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.badge, { backgroundColor: tone === 'pass' ? c.passSoft : c.signalSoft }]}
    >
      {id === 'script_mastered' ? (
        <LadderIcon size={16} color={color} />
      ) : (
        <Check size={16} color={color} strokeWidth={2.5} />
      )}
      <Txt variant="small" weight="bodySemi" style={{ color }} fontSize={14}>
        {label}
      </Txt>
    </View>
  );
}

/** Rank chip on Home: title only, no number. */
export function RankChip({ title, onPress }: { title: string; onPress?: () => void }) {
  const { c } = useTheme();
  const body = (
    <>
      <LadderIcon size={18} color={c.signal} />
      <Txt variant="meta" weight="bodySemi" fontSize={15}>
        {title}
      </Txt>
    </>
  );
  if (!onPress) {
    return (
      <View
        accessible
        accessibilityLabel={`Rank: ${title}`}
        style={[styles.rankChip, { backgroundColor: c.surface }]}
      >
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Rank: ${title}`}
      accessibilityHint="Opens your progress"
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.rankChip,
        { backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      {body}
    </Pressable>
  );
}

/** List-question answer: got (green tint) or missed (dashed coral outline, a gap not an error). */
export function AnswerPill({ text, got }: { text: string; got: boolean }) {
  const { c } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${got ? 'Named' : 'Missed'}: ${text}`}
      style={[
        styles.pill,
        got
          ? { backgroundColor: c.passSoft }
          : { borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.miss },
      ]}
    >
      {got ? (
        <Check size={20} color={c.pass} strokeWidth={2.5} />
      ) : (
        <CircleMinus size={20} color={c.miss} />
      )}
      <Txt variant="body" weight="bodyMedium" fontSize={17} style={styles.grow}>
        {text}
      </Txt>
    </View>
  );
}

/**
 * Rank track: six steps of rising height. Past steps amber, the current one
 * amber with a 2 pt outline, future steps surface2. `rise` animates the
 * current step into place (the promotion moment, 400 ms).
 */
export function RankTrack({
  index,
  height = 160,
  rise = false,
  labels = true,
}: {
  index: number;
  height?: number;
  rise?: boolean;
  labels?: boolean;
}) {
  const { c } = useTheme();
  const reduceMotion = useReduceMotion();
  const [grow] = useState(() => new Animated.Value(rise ? 0 : 1));

  useEffect(() => {
    if (!rise || reduceMotion) {
      grow.setValue(1);
      return;
    }
    Animated.timing(grow, {
      toValue: 1,
      duration: 400,
      delay: 250,
      easing: Easing.bezier(0.2, 0.9, 0.3, 1.2),
      useNativeDriver: false,
    }).start();
  }, [rise, reduceMotion, grow]);

  const min = height * 0.15;
  return (
    <View accessible accessibilityLabel={`Rank ${index + 1} of 6: ${RANKS[index]?.title ?? ''}`}>
      <View style={[styles.track, { height }]}>
        {RANKS.map((r, i) => {
          const h = min + ((height - min) * i) / (RANKS.length - 1);
          const here = i === index;
          const animated = here && rise;
          return (
            <View key={r.title} style={styles.trackCol}>
              <Animated.View
                style={[
                  styles.step,
                  {
                    height: animated
                      ? grow.interpolate({ inputRange: [0, 1], outputRange: [min * 0.5, h] })
                      : h,
                    backgroundColor: i <= index ? c.signal : c.surface2,
                  },
                  here && { borderWidth: 2, borderColor: c.text },
                ]}
              />
            </View>
          );
        })}
      </View>
      {labels && (
        <View style={styles.trackLabels}>
          {RANKS.map((r, i) => (
            <Txt
              key={r.title}
              variant="small"
              tone={i === index ? 'text' : 'text3'}
              weight={i === index ? 'bodySemi' : 'bodyMedium'}
              fontSize={11.5}
              lineHeight={15}
              style={styles.trackLabel}
            >
              {r.title}
            </Txt>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 6 },
  gridRow: { flexDirection: 'row', gap: 6 },
  gridCell: { flex: 1, aspectRatio: 1, borderRadius: 6 },
  rotations: { gap: space.xl },
  rotationRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  rotationName: { width: 128 },
  rotationBar: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  rotationCount: { minWidth: 48, textAlign: 'right' },
  segments: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 6, borderRadius: 3 },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  mini: { flexDirection: 'column-reverse', gap: 2, width: 22 },
  miniBar: { height: 3, borderRadius: 1.5 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 11,
    borderRadius: 8,
  },
  rankChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 36,
    paddingLeft: 12,
    paddingRight: 14,
    borderRadius: radius.chip,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderRadius: radius.row,
  },
  grow: { flex: 1 },
  track: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  trackCol: { flex: 1, justifyContent: 'flex-end' },
  step: { borderRadius: 6 },
  trackLabels: { flexDirection: 'row', gap: 6, marginTop: 10 },
  trackLabel: { flex: 1 },
});
