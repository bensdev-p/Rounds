/**
 * Settings, a placeholder until M2.3 (wireframe 12). For now it holds the
 * daily goal, moved here from Progress so Profile matches profile.png.
 * Anki, voice, appearance and account join in later milestones.
 */
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Disclaimer } from '@/components/Disclaimer';
import { plural } from '@/lib/copy';
import { MAX_ROUNDS_GOAL, MIN_ROUNDS_GOAL, useRoundsGoal } from '@/lib/prefs';
import { space } from '@/theme';
import { Link, Panel, Segmented } from '@/ui/controls';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Text';

const GOALS = Array.from({ length: MAX_ROUNDS_GOAL - MIN_ROUNDS_GOAL + 1 }, (_, i) => {
  const n = String(MIN_ROUNDS_GOAL + i);
  return { value: n, label: n };
});

export default function Settings() {
  const [goal, setGoal] = useRoundsGoal();
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

      <View style={styles.sectionHead}>
        <Txt variant="h3" fontSize={19} accessibilityRole="header">
          Daily goal
        </Txt>
        <Txt variant="meta" tone="text2" fontSize={16}>
          {plural(goal, 'session')}
        </Txt>
      </View>
      <Panel style={styles.goalPanel}>
        <Segmented
          label="Sessions per day to finish rounds"
          options={GOALS}
          value={String(goal)}
          onChange={(v) => setGoal(Number(v))}
        />
      </Panel>
      <Txt variant="small" tone="text2" style={styles.caption}>
        Finish this many sessions in a day and it counts as a shift.
      </Txt>

      <Txt variant="meta" tone="text2" style={styles.later}>
        Anki, voice, appearance and your account come in later builds.
      </Txt>

      <Disclaimer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.md },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: space.xl,
    marginBottom: space.md,
  },
  goalPanel: { padding: space.sm },
  caption: { marginTop: space.md },
  later: { marginTop: space.section },
});
