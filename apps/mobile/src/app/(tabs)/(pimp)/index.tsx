/** Pimp (home). One obvious action: "Pimp me". Wireframe 02, mockup home.png. */
import {
  PERSONAS,
  pickScript,
  rankFor,
  rotationPool,
  roundsToday,
  shiftStreak,
  startOfToday,
  totalRungs,
  weekOfRotation,
  type PersonaId,
} from '@rounds/shared';
import { listFinishedSessions, listLogsSince, listPimpableScripts } from '@rounds/shared/api';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Disclaimer } from '@/components/Disclaimer';
import { ErrorView, Loading } from '@/components/StatusView';
import { TodaysPatients } from '@/features/log/TodaysPatients';
import { useClient } from '@/lib/auth';
import { ROTATION_NAMES, streakLine, todayLabel } from '@/lib/copy';
import { usePersona, useProfile, useRoundsGoal } from '@/lib/profile';
import { useAsync } from '@/lib/useAsync';
import { radius, space, useTheme } from '@/theme';
import { Button, Link, Panel, Segmented } from '@/ui/controls';
import { Mic } from 'lucide-react-native';
import { RankChip, Segments } from '@/ui/progress';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Text';
import { loadErrorMessage } from '@/lib/errors';

/** In the mockup's order: patient, rapid-fire, Socratic. */
const PERSONA_ORDER: readonly PersonaId[] = ['teacher', 'surgeon', 'internist'];
const PERSONA_OPTIONS = PERSONA_ORDER.map((value) => ({
  value,
  label: PERSONAS[value].label,
}));

export default function PimpHome() {
  const { c } = useTheme();
  const client = useClient();
  const { profile } = useProfile();
  const [persona, setPersona] = usePersona();
  const [goal] = useRoundsGoal();
  const data = useAsync(async () => {
    const [scripts, sessions, logs] = await Promise.all([
      listPimpableScripts(client),
      listFinishedSessions(client),
      listLogsSince(client, startOfToday(new Date())),
    ]);
    return { scripts, sessions, logs };
  }, 'home');
  const { reload } = data;

  // Refresh progress when coming back from a session (not on first mount).
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) reload();
      focused.current = true;
    }, [reload]),
  );

  if (data.status === 'loading') return <Loading label="Loading your rounds" />;
  if (data.status === 'error') {
    return (
      <ErrorView
        message={loadErrorMessage("Couldn't load your rounds.", data.error)}
        onRetry={reload}
      />
    );
  }

  const { scripts, sessions, logs } = data.data;
  const now = new Date();
  const rounds = roundsToday(sessions, now, goal);
  const streak = shiftStreak(sessions, now, goal);
  const rank = rankFor(totalRungs(sessions));
  const rotation = ROTATION_NAMES[profile.rotation];
  const week = weekOfRotation(profile, now);
  const pool = rotationPool(
    profile.rotation,
    scripts.map((s) => s.script),
  );

  function chooseTopic() {
    router.push({ pathname: '/topics', params: { persona } });
  }

  function changeRotation() {
    router.push({ pathname: '/rotation', params: { persona } });
  }

  function pimpMe() {
    // "Pimp me on <rotation>": a script from the rotation, weighted toward misses and unseen ones.
    const scriptId = pickScript(pool.scriptIds, sessions, {
      exclude: sessions.at(-1)?.script_id,
    });
    if (!scriptId) return;
    router.push({ pathname: '/session/[scriptId]', params: { scriptId, persona } });
  }

  function startOn(scriptId: string) {
    router.push({ pathname: '/session/[scriptId]', params: { scriptId, persona } });
  }

  return (
    <Screen tab>
      <View style={styles.top}>
        <Txt variant="meta" tone="text2">
          {todayLabel(now)}
        </Txt>
        <RankChip title={rank.title} onPress={() => router.navigate('/profile')} />
      </View>
      <Txt variant="h1" accessibilityRole="header" style={styles.title}>
        {rotation}
      </Txt>
      <View style={styles.sub}>
        {week && (
          <Txt variant="meta" tone="text2" tabular>
            Week {week.week} of {week.of}
          </Txt>
        )}
        <Link
          label="Change rotation"
          accessibilityHint="Your year, rotation and week"
          onPress={changeRotation}
        />
        <Link
          label="Topics"
          accessibilityHint="Choose a topic to be pimped on"
          onPress={chooseTopic}
        />
      </View>

      <Panel level="hero" style={styles.hero}>
        <View style={styles.roundsHead}>
          <Txt variant="h3">{"Today's rounds"}</Txt>
          <Txt variant="small" tone="text2">
            <Txt variant="h2" fontSize={16} lineHeight={18} tabular>
              {Math.min(rounds.done, rounds.goal)}
            </Txt>{' '}
            of {rounds.goal} {rounds.goal === 1 ? 'session' : 'sessions'}
          </Txt>
        </View>
        <Segments filled={rounds.done} total={rounds.goal} />
        <Txt variant="small" tone="text2" style={styles.streak}>
          {streakLine(rounds, streak)}
        </Txt>
        <View style={[styles.divider, { backgroundColor: c.line }]} />
        <Txt variant="h3" style={styles.askHead}>
          {"Who's pimping?"}
        </Txt>
        <Segmented
          label="Attending persona"
          onPanel
          options={PERSONA_OPTIONS}
          value={persona}
          onChange={setPersona}
        />
        <Button
          hero
          label="Pimp me"
          icon={Mic}
          accessibilityHint={
            scripts.length > 0
              ? `Starts a ${PERSONAS[persona].label} session on a topic chosen for you`
              : undefined
          }
          disabled={scripts.length === 0}
          onPress={pimpMe}
          longPress={{ label: 'Choose a topic', onPress: chooseTopic }}
          style={styles.pimp}
        />
        {pool.fallback && (
          <Txt variant="small" tone="text2" style={styles.empty}>
            No scripts for {rotation} yet, so Pimp me asks from the others.
          </Txt>
        )}
        {scripts.length === 0 && (
          <Txt variant="small" tone="text2" style={styles.empty}>
            No approved scripts yet. Run `pnpm content:seed && pnpm db:reset` locally.
          </Txt>
        )}
      </Panel>

      <TodaysPatients logs={logs} onStart={startOn} />

      <Disclaimer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.sm,
  },
  title: { marginTop: 6 },
  // Mockup: "Week 3 of 8 " then the link 10 px further on, about 14 in all.
  sub: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 6 },
  hero: {
    marginTop: 22,
    borderRadius: radius.hero,
    paddingTop: 18,
    paddingHorizontal: space.xl,
    paddingBottom: space.xl,
  },
  roundsHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  streak: { marginTop: space.sm },
  divider: { height: 1, marginVertical: 14 },
  askHead: { marginBottom: space.md },
  pimp: { marginTop: space.lg },
  empty: { marginTop: space.md },
});
