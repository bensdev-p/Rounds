/**
 * Year, rotation and which week of it: onboarding (wireframe 01) and "Change
 * rotation" on Home. The week rows aren't drawn; they feed Home's "Week 3 of
 * 8" (home.png) and can be left out.
 */
import {
  DEFAULT_ROTATION_WEEKS,
  MAX_ROTATION_WEEKS,
  ROTATIONS,
  YEARS,
  rotationStartForWeek,
  weekOfRotation,
  type Profile,
  type Rotation,
  type Year,
} from '@rounds/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ROTATION_NAMES } from '@/lib/copy';
import { space } from '@/theme';
import { ChoiceRow, Link, Panel, Segmented, Stepper } from '@/ui/controls';
import { Txt } from '@/ui/Text';

/** Wireframe 01 lists these four first; "More..." shows the rest. */
const FIRST_ROTATIONS: readonly Rotation[] = ['IM', 'surgery', 'peds', 'obgyn'];

export interface RotationChoice {
  year: Year | null;
  rotation: Rotation;
  /** Null when the student left the week out. */
  week: number | null;
  weeks: number;
}

export function choiceFromProfile(profile: Profile | null, now: Date): RotationChoice {
  if (!profile) return { year: null, rotation: 'IM', week: 1, weeks: DEFAULT_ROTATION_WEEKS };
  const current = weekOfRotation(profile, now);
  return {
    year: profile.year,
    rotation: profile.rotation,
    week: current?.week ?? null,
    weeks: current?.of ?? profile.rotation_weeks ?? DEFAULT_ROTATION_WEEKS,
  };
}

/** The profile fields a choice sets. */
export function profileFields(
  choice: RotationChoice & { year: Year },
  now: Date,
): Pick<Profile, 'year' | 'rotation' | 'rotation_started_on' | 'rotation_weeks'> {
  return {
    year: choice.year,
    rotation: choice.rotation,
    rotation_started_on: choice.week === null ? null : rotationStartForWeek(choice.week, now),
    rotation_weeks: choice.week === null ? null : choice.weeks,
  };
}

const YEAR_OPTIONS = YEARS.map((y) => ({ value: y, label: y }));

export function RotationForm({
  value,
  onChange,
}: {
  value: RotationChoice;
  onChange: (next: RotationChoice) => void;
}) {
  const [showAll, setShowAll] = useState(!FIRST_ROTATIONS.includes(value.rotation));
  const rotations = showAll ? ROTATIONS : FIRST_ROTATIONS;
  const set = (patch: Partial<RotationChoice>) => onChange({ ...value, ...patch });

  return (
    <View>
      <Txt variant="h3" accessibilityRole="header" style={styles.question}>
        What year are you?
      </Txt>
      <Segmented<Year | ''>
        label="Year of medical school"
        options={YEAR_OPTIONS}
        value={value.year ?? ''}
        onChange={(year) => year && set({ year })}
      />

      <Txt variant="h3" accessibilityRole="header" style={styles.question}>
        Current rotation
      </Txt>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Current rotation"
        style={styles.list}
      >
        {rotations.map((r) => (
          <ChoiceRow
            key={r}
            label={ROTATION_NAMES[r]}
            selected={value.rotation === r}
            onPress={() => set({ rotation: r })}
          />
        ))}
        {!showAll && (
          <ChoiceRow label="More..." selected={false} onPress={() => setShowAll(true)} />
        )}
      </View>

      <Txt variant="h3" accessibilityRole="header" style={styles.question}>
        Which week is it?
      </Txt>
      {value.week === null ? (
        <View style={styles.leftOut}>
          <Txt variant="meta" tone="text2">
            Left out.
          </Txt>
          <Link label="Add it" onPress={() => set({ week: 1 })} />
        </View>
      ) : (
        <>
          <Panel style={styles.weekPanel}>
            <Txt variant="body">Week</Txt>
            <Stepper
              label="Week of the rotation"
              value={value.week}
              min={1}
              max={value.weeks}
              onChange={(week) => set({ week })}
            />
            <Txt variant="body">of</Txt>
            <Stepper
              label="Weeks in the rotation"
              value={value.weeks}
              min={1}
              max={MAX_ROTATION_WEEKS}
              onChange={(weeks) => set({ weeks, week: Math.min(value.week ?? 1, weeks) })}
            />
          </Panel>
          <View style={styles.leftOut}>
            <Txt variant="small" tone="text2">
              Shows as “Week {value.week} of {value.weeks}” on Pimp.
            </Txt>
            <Link label="Leave it out" onPress={() => set({ week: null })} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  question: { marginTop: space.section, marginBottom: space.md },
  list: { gap: space.md },
  weekPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
  },
  leftOut: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.md,
  },
});
