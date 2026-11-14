/**
 * Profile tab, titled "Progress". Wireframe 11, mockups profile.png and
 * profile-light.png. Rank, the shifts grid, mastery by rotation and the entry
 * to Settings. Everything is derived from finished sessions.
 * The Teams row (mockup) joins above Settings in Stage 5.
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
import { ChevronRight } from 'lucide-react-native';
import { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { ErrorView, Loading } from '@/components/StatusView';
import { useClient } from '@/lib/auth';
import { plural, ROTATION_SHORT_NAMES } from '@/lib/copy';
import { loadErrorMessage } from '@/lib/errors';
import { useRoundsGoal } from '@/lib/profile';
import { useAsync } from '@/lib/useAsync';
import { space, useTheme } from '@/theme';
import { Link, List, Panel, Row } from '@/ui/controls';
import { RankTrack, RotationBars, ShiftGrid } from '@/ui/progress';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Text';

export default function Progress() {
  const { c } = useTheme();
  const client = useClient();
  const [goal] = useRoundsGoal();
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
    <Screen tab>
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
        Outlined days were post-call. You get one a week.
      </Txt>

      <View style={styles.sectionHead}>
        <Txt variant="h3" fontSize={19} accessibilityRole="header">
          Mastered by rotation
        </Txt>
        <Link label="All scripts" onPress={() => router.push('/profile/collection')} />
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

      <View style={styles.entries}>
        <List>
          <Row
            first
            title="Settings"
            accessibilityHint="Daily goal, and more settings later"
            onPress={() => router.push('/profile/settings')}
            trailing={<ChevronRight size={20} color={c.text3} />}
          />
        </List>
      </View>
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
  entries: { marginTop: space.lg },
});
