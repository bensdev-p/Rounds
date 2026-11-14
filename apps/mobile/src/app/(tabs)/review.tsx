/**
 * Tonight's review (wireframe 09, mockups review.png and review-light.png).
 * Three things, and it ends: the misses (at most five; the rest roll to
 * tomorrow), one mix-up to sort out, and today's patients not yet practised.
 * The Anki row stays hidden until the add-on exists (note 3, Stage 3).
 */
import {
  comparisonRows,
  clockLabel,
  missedRows,
  missSubtitle,
  mixUpPair,
  patientsToPractise,
  reviewMinutes,
  startOfToday,
  timesThisWeek,
  windowStart,
  type IllnessScript,
} from '@rounds/shared';
import {
  listFinishedSessions,
  listLogsSince,
  listMissesSince,
  listPimpableScripts,
} from '@rounds/shared/api';
import { router, useFocusEffect } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { ErrorView, Loading } from '@/components/StatusView';
import { Comparison } from '@/features/review/Comparison';
import { useClient } from '@/lib/auth';
import { loadErrorMessage } from '@/lib/errors';
import { usePersona } from '@/lib/prefs';
import { useAsync } from '@/lib/useAsync';
import { space, useTheme } from '@/theme';
import { Button, Chip, List, Row, SectionHead } from '@/ui/controls';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Text';

export default function Review() {
  const { c } = useTheme();
  const client = useClient();
  const [persona] = usePersona();

  const data = useAsync(async () => {
    const now = new Date();
    const [scripts, misses, sessions, logs] = await Promise.all([
      listPimpableScripts(client),
      listMissesSince(client, windowStart(now)),
      listFinishedSessions(client),
      listLogsSince(client, startOfToday(now)),
    ]);
    return { scripts, misses, sessions, logs };
  }, 'review');
  const { reload } = data;

  // Misses and patients change after a session, so refresh when the tab comes back.
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) reload();
      focused.current = true;
    }, [reload]),
  );

  if (data.status === 'loading') return <Loading label="Gathering today's misses" />;
  if (data.status === 'error') {
    return (
      <ErrorView
        message={loadErrorMessage("Couldn't load tonight's review.", data.error)}
        onRetry={reload}
      />
    );
  }

  const now = new Date();
  const { scripts, misses, sessions, logs } = data.data;
  const byId = new Map<string, IllnessScript>(scripts.map((s) => [s.script.id, s.script]));
  // Only scripts the student can see (this also leaves out the test fixtures).
  const visible = misses.filter((m) => byId.has(m.script_id));
  const { rows, rolled } = missedRows(visible, sessions, now);
  const pair = mixUpPair(visible, now);
  const left = pair ? byId.get(pair.script_id) : undefined;
  const right = pair ? byId.get(pair.other_id) : undefined;
  const showPair = pair !== null && left !== undefined && right !== undefined;
  const patients = patientsToPractise(logs, sessions, now).filter((p) => byId.has(p.script_id));
  const items = rows.length + (showPair ? 1 : 0) + patients.length;

  const openScript = (scriptId: string) =>
    router.push({ pathname: '/script/[scriptId]', params: { scriptId, from: 'Review' } });
  const startOn = (scriptId: string) =>
    router.push({ pathname: '/session/[scriptId]', params: { scriptId, persona } });

  return (
    <Screen tab>
      <Txt variant="h1" accessibilityRole="header" style={styles.title}>
        {"Tonight's review"}
      </Txt>
      {items > 0 && (
        <Txt variant="meta" tone="text2" style={styles.minutes}>
          {reviewMinutes(items)}
        </Txt>
      )}

      <SectionHead title="Missed today" style={styles.firstSection} />
      {rows.length === 0 ? (
        <Txt variant="meta" tone="text2">
          Nothing missed today. Misses from your sessions land here tonight.
        </Txt>
      ) : (
        <List>
          {rows.map((row, i) => {
            const name = byId.get(row.script_id)?.name ?? row.script_id;
            const subtitle = missSubtitle(row.miss);
            return (
              <Row
                key={row.script_id}
                first={i === 0}
                leading={<View style={[styles.mark, { backgroundColor: c.miss }]} />}
                title={name}
                subtitle={subtitle}
                trailing={<ChevronRight size={18} color={c.text3} />}
                accessibilityLabel={`${name}, ${subtitle}`}
                accessibilityHint="Opens the script"
                onPress={() => openScript(row.script_id)}
              />
            );
          })}
        </List>
      )}
      {rolled > 0 && (
        <Txt variant="small" tone="text2" style={styles.rolled}>
          {rolled === 1 ? '1 more tomorrow.' : `${rolled} more tomorrow.`}
        </Txt>
      )}

      {showPair && (
        <>
          <SectionHead
            title="You keep mixing these up"
            right={
              <Txt variant="small" tone="text2" tabular>
                {timesThisWeek(pair.count)}
              </Txt>
            }
          />
          <Comparison
            leftName={left.name}
            rightName={right.name}
            rows={comparisonRows(left, right)}
            fallback={
              left.confused_with.find((l) => l.script_id === right.id)?.how_to_tell_apart ?? null
            }
          />
          <Button
            label="Drill this pair"
            variant="quiet"
            accessibilityHint={`Asks how to tell ${left.name} from ${right.name}`}
            onPress={() =>
              router.push({ pathname: '/drill', params: { a: left.id, b: right.id, persona } })
            }
            style={styles.drill}
          />
        </>
      )}

      {patients.length > 0 && (
        <>
          <SectionHead title="From today's patients" />
          <List>
            {patients.map((log, i) => (
              <Row
                key={log.id}
                first={i === 0}
                title={log.label}
                subtitle={`Logged ${clockLabel(log.logged_at)}`}
                trailing={
                  <Chip
                    role="button"
                    label="Start"
                    accessibilityLabel={`Start a session on ${log.label}`}
                    onPress={() => startOn(log.script_id)}
                  />
                }
              />
            ))}
          </List>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.md },
  minutes: { marginTop: 6 },
  firstSection: { marginTop: 22 },
  mark: { width: 8, height: 8, borderRadius: 4 },
  rolled: { marginTop: space.sm },
  drill: { marginTop: space.md, height: 46 },
});
