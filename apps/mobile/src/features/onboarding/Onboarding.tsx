/**
 * Onboarding, wireframe 01: year and rotation, then straight to Pimp. No
 * account wall (note 2): sign-in is offered after the first session. The
 * persona stays on Home and the daily goal starts at 3 (Settings changes it).
 */
import { newProfile, type Profile } from '@rounds/shared';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { earlierDeviceChoices } from '@/lib/prefs';
import { space } from '@/theme';
import { Button } from '@/ui/controls';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Text';
import { choiceFromProfile, profileFields, RotationForm } from './RotationForm';

export function Onboarding({ onDone }: { onDone: (profile: Profile) => Promise<void> }) {
  const [choice, setChoice] = useState(() => choiceFromProfile(null, new Date()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const year = choice.year;

  async function finish() {
    if (!year) return;
    setSaving(true);
    setError(null);
    try {
      await onDone(
        newProfile({
          ...earlierDeviceChoices(),
          ...profileFields({ ...choice, year }, new Date()),
        }),
      );
    } catch {
      setError("Couldn't save. Check the connection and try again.");
      setSaving(false);
    }
  }

  return (
    <Screen
      footer={
        <>
          {error && (
            <Txt variant="small" tone="miss" accessibilityRole="alert" style={styles.error}>
              {error}
            </Txt>
          )}
          <Button
            label="Continue"
            disabled={!year || saving}
            accessibilityHint={year ? undefined : 'Choose your year first'}
            onPress={finish}
          />
        </>
      }
    >
      <Txt variant="h1" accessibilityRole="header" style={styles.title}>
        Set up PimpMe
      </Txt>
      <Txt variant="meta" tone="text2" style={styles.sub}>
        Two questions. Change any time.
      </Txt>
      <RotationForm value={choice} onChange={setChoice} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.xxl },
  sub: { marginTop: space.sm },
  error: { marginBottom: space.md },
});
