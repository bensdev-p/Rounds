/**
 * Progress. Wireframe 11, mockup profile.png. Opened from the rank chip on
 * Home. Rank, the shifts grid and mastery, plus the daily goal. Everything is
 * derived from finished sessions; no new data is stored except the goal.
 */
import {
  masteryByRotation,
  rankFor,
  shiftDays,
  shiftGrid,
  shiftStreak,
  totalRungs,
} from '@rounds/shared';
import { listFinishedSessions, listPimpableScripts } from '@rounds/shared/api';
import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Disclaimer } from '@/components/Disclaimer';
import { ErrorView, Loading } from '@/components/StatusView';
import { useClient } from '@/lib/auth';
import { plural, ROTATION_SHORT_NAMES } from '@/lib/copy';
import { loadErrorMessage } from '@/lib/errors';
import { MAX_ROUNDS_GOAL, MIN_ROUNDS_GOAL, useRoundsGoal } from '@/lib/prefs';
import { useAsync } from '@/lib/useAsync';
import { space } from '@/theme';
import { Link, Panel, Segmented } from '@/ui/controls';
import { RankTrack, RotationBars, ShiftGrid } from '@/ui/progress';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Text';

const GOALS = Array.from({ length: MAX_ROUNDS_GOAL - MIN_ROUNDS_GOAL + 1 }, (_, i) => {
  const n = String(MIN_ROUNDS_GOAL + i);
  return { value: n, label: n };
});

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function Progress() {
  const client = useClient();
  const [goal, setGoal] = useRoundsGoal();
  const data = useAsync(async () => {
    const [scripts, sessions] = await Promise.all([
      listPimpableScripts(client),
      listFinishedSessions(client),
    ]);
    return { scripts, sessions };
  }, 'progress');
  const { reload } = data;

  // Refresh when coming back from a session or the collection.
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) reload();
      focused.current = true;
    }, [reload]),
  );

  if (data.status === 'loading') return <Loading label="Loading your progress" />;
  if (data.status === 'error') {
    return (
      <ErrorView
        message={loadErrorMessage("Couldn't load your progress.", data.error)}
        onRetry={reload}
      />
    );
  }

  const { scripts, sessions } = data.data;
  const now = new Date();
  const rank = rankFor(totalRungs(sessions));
  const streak = shiftStreak(sessions, now, goal);
  const grid = shiftGrid(sessions, now, goal);
  const totalShifts = shiftDays(sessions, goal).size;
  const rotations = masteryByRotation(
    scripts.map((s) => ({ id: s.script.id, rotation: s.script.rotation })),
    sessions,
    now,
  );

  const streakText =
    streak.count > 0 ? `${streak.count} in a row` : `${plural(totalShifts, 'shift')} so far`;

  return (
    <Screen>
      <Link label="Pimp" icon={ChevronLeft}
        back onPress={goBack} />
      <Txt variant="h1" accessibilityRole="header" style={styles.title}>
        Progress
      </Txt>

      <Panel level="panel" style={styles.rankCard}>
        <View style={styles.rankHead}>
          <Txt variant="h1" fontSize={34}>
            {rank.title}
          </Txt>
          <Txt variant="meta" tone="text2" fontSize={16}>
            <Txt variant="h2" fontSize={18} tabular>
              {rank.totalRungs.toLocaleString('en-US')}
            </Txt>{' '}
            rungs climbed
          </Txt>
        </View>
        <RankTrack index={rank.index} height={56} />
        <Txt variant="meta" tone="text2" fontSize={16}>
          {rank.next && rank.toNext !== null
            ? `${plural(rank.toNext, 'rung')} to ${rank.next.title}`
            : "That's the top rank."}
        </Txt>
      </Panel>

      <View style={styles.sectionHead}>
        <Txt variant="h3" fontSize={19} accessibilityRole="header">
          Shifts
        </Txt>
        <Txt variant="meta" tone="text2" fontSize={16}>
          {streakText}
        </Txt>
      </View>
      <ShiftGrid days={grid} label={`Shifts, last 28 days. ${streakText}.`} />
      <Txt variant="meta" tone="text2" fontSize={15} style={styles.caption}>
        {`A shift is a day you finish rounds. Outlined days were post-call. You get one a week.`}
      </Txt>

      <View style={styles.sectionHead}>
        <Txt variant="h3" fontSize={19} accessibilityRole="header">
          Mastered by rotation
        </Txt>
        <Link label="All scripts" onPress={() => router.push('/collection')} />
      </View>
      <Panel>
        {rotations.length > 0 ? (
          <RotationBars
            rows={rotations.map((r) => ({
              name: ROTATION_SHORT_NAMES[r.rotation],
              mastered: r.mastered,
              total: r.total,
            }))}
          />
        ) : (
          <Txt variant="meta" tone="text2">
            No scripts yet.
          </Txt>
        )}
      </Panel>
      <Txt variant="small" tone="text2" style={styles.caption}>
        A script is mastered when you reach rung 6 on two different days.
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

      <Disclaimer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.md },
  rankCard: { marginTop: space.xl, gap: space.lg },
  rankHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: space.section + space.sm,
    marginBottom: space.md,
  },
  caption: { marginTop: space.md },
  goalPanel: { padding: space.sm },
});
