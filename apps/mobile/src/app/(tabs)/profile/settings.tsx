/**
 * Settings, wireframe 12 without the Anki part (M3.1). The daily goal isn't
 * drawn; it lives here above Voice (developer's call, M2.3). The voice speed
 * row joins Voice with the voice session (M2.5).
 */
import {
  ANSWER_TIMEOUTS,
  MAX_ROUNDS_GOAL,
  MIN_ROUNDS_GOAL,
  answerTimeoutLabel,
} from '@rounds/shared';
import { router } from 'expo-router';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Disclaimer } from '@/components/Disclaimer';
import { useAccount } from '@/lib/auth';
import { plural } from '@/lib/copy';
import { useAppearance, type Appearance } from '@/lib/prefs';
import { useProfile } from '@/lib/profile';
import { space, useTheme } from '@/theme';
import { Link, List, Panel, Row, SectionHead, Segmented } from '@/ui/controls';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Text';

const GOALS = Array.from({ length: MAX_ROUNDS_GOAL - MIN_ROUNDS_GOAL + 1 }, (_, i) => {
  const n = String(MIN_ROUNDS_GOAL + i);
  return { value: n, label: n };
});

const APPEARANCES: readonly { value: Appearance; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export default function Settings() {
  const { c } = useTheme();
  const { profile, update } = useProfile();
  const { account } = useAccount();
  const [appearance, setAppearance] = useAppearance();
  const [choosingTimeout, setChoosingTimeout] = useState(false);
  const goal = profile.daily_goal;

  return (
    <Screen tab>
      <Link
        label="Profile"
        icon={ChevronLeft}
        back
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
      />
      <Txt variant="h1" accessibilityRole="header" style={styles.title}>
        Settings
      </Txt>

      <SectionHead
        title="Daily goal"
        style={styles.firstSection}
        right={
          <Txt variant="meta" tone="text2">
            {plural(goal, 'session')}
          </Txt>
        }
      />
      <Panel style={styles.segmentPanel}>
        <Segmented
          label="Sessions per day to finish rounds"
          options={GOALS}
          value={String(goal)}
          onChange={(v) => void update({ daily_goal: Number(v) })}
        />
      </Panel>
      <Txt variant="small" tone="text2" style={styles.caption}>
        Finish this many sessions in a day and it counts as a shift.
      </Txt>

      <SectionHead title="Voice" />
      <List>
        <Row
          first
          title="Answer timeout"
          onPress={() => setChoosingTimeout((open) => !open)}
          accessibilityLabel={`Answer timeout, ${answerTimeoutLabel(profile.answer_timeout)}`}
          accessibilityHint="Overrides the persona's time limit"
          trailing={
            <Txt variant="meta" tone="text2">
              {answerTimeoutLabel(profile.answer_timeout)}
            </Txt>
          }
        />
        {choosingTimeout && (
          <View accessibilityRole="radiogroup" accessibilityLabel="Answer timeout">
            {ANSWER_TIMEOUTS.map((t) => {
              const on = t === profile.answer_timeout;
              return (
                <Row
                  key={t}
                  title={answerTimeoutLabel(t)}
                  accessibilityLabel={`${answerTimeoutLabel(t)}${on ? ', selected' : ''}`}
                  onPress={() => {
                    void update({ answer_timeout: t });
                    setChoosingTimeout(false);
                  }}
                  trailing={on ? <Check size={20} color={c.text} /> : undefined}
                />
              );
            })}
          </View>
        )}
      </List>
      <Txt variant="small" tone="text2" style={styles.caption}>
        Surgeon gives 10 s and Internist 30 s; Teacher waits. A right answer past the limit counts
        as slow.
      </Txt>

      <SectionHead title="Appearance" />
      <Panel style={styles.segmentPanel}>
        <Segmented
          label="Appearance"
          options={APPEARANCES}
          value={appearance}
          onChange={setAppearance}
        />
      </Panel>

      <View style={styles.account}>
        <List>
          <Row
            first
            title="Account"
            subtitle={
              account.isAnonymous ? 'Not signed in' : (account.email ?? 'Signed in with Apple')
            }
            onPress={() => router.push('/profile/account')}
            trailing={<ChevronRight size={20} color={c.text3} />}
          />
        </List>
      </View>

      <Disclaimer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.md },
  firstSection: { marginTop: space.xl },
  segmentPanel: { padding: space.sm },
  caption: { marginTop: space.md },
  account: { marginTop: space.section },
});
