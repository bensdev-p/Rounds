/** Pimp (home). One obvious action: "Pimp me". Wireframe 02, mockup home.png. */
import {
  PERSONAS,
  pickScript,
  rankFor,
  roundsToday,
  shiftStreak,
  totalRungs,
  type PersonaId,
} from '@rounds/shared';
import { listFinishedSessions, listPimpableScripts } from '@rounds/shared/api';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Disclaimer } from '@/components/Disclaimer';
import { ErrorView, Loading } from '@/components/StatusView';
import { useClient } from '@/lib/auth';
import { ROTATION_NAMES, streakLine, todayLabel } from '@/lib/copy';
import { usePersona, useRoundsGoal } from '@/lib/prefs';
import { useAsync } from '@/lib/useAsync';
import { radius, space, useTheme } from '@/theme';
import { Button, Link, Panel, Segmented } from '@/ui/controls';
import { LadderIcon } from '@/ui/icons';
import { RankChip, Segments } from '@/ui/progress';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Text';
import { loadErrorMessage } from '@/lib/errors';

const PERSONA_OPTIONS = (Object.keys(PERSONAS) as PersonaId[]).map((value) => ({
  value,
  label: PERSONAS[value].label,
}));

export default function PimpHome() {
  const { c } = useTheme();
  const client = useClient();
  const [persona, setPersona] = usePersona();
  const [goal] = useRoundsGoal();
  const data = useAsync(async () => {
    const [scripts, sessions] = await Promise.all([
      listPimpableScripts(client),
      listFinishedSessions(client),
    ]);
    return { scripts, sessions };
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

  const { scripts, sessions } = data.data;
  const now = new Date();
  const rounds = roundsToday(sessions, now, goal);
  const streak = shiftStreak(sessions, now, goal);
  const rank = rankFor(totalRungs(sessions));
  // Stage 1 content is internal medicine only.
  const rotation = ROTATION_NAMES[scripts[0]?.script.rotation[0] ?? 'IM'];

  function pimpMe() {
    const scriptId = pickScript(
      scripts.map((s) => ({ script_id: s.script.id, bestRung: s.bestRung })),
      { exclude: sessions.at(-1)?.script_id },
    );
    if (!scriptId) return;
    router.push({ pathname: '/session/[scriptId]', params: { scriptId, persona } });
  }

  return (
    <Screen>
      <View style={styles.top}>
        <Txt variant="meta" tone="text2" fontSize={16}>
          {todayLabel(now)}
        </Txt>
        <RankChip title={rank.title} onPress={() => router.push('/progress')} />
      </View>
      <Txt variant="h1" accessibilityRole="header" style={styles.title}>
        {rotation}
      </Txt>
      <View style={styles.sub}>
        <Link
          label="Choose a topic"
          accessibilityHint="Lists every script with your best rung"
          onPress={() => router.push({ pathname: '/topics', params: { persona } })}
        />
      </View>

      <Panel level="hero" style={styles.hero}>
        <View style={styles.roundsHead}>
          <Txt variant="h3" fontSize={18}>
            {"Today's rounds"}
          </Txt>
          <Txt variant="meta" tone="text2" fontSize={15}>
            <Txt variant="meta" weight="bodySemi" fontSize={15} tabular>
              {Math.min(rounds.done, rounds.goal)}
            </Txt>{' '}
            of {rounds.goal} {rounds.goal === 1 ? 'session' : 'sessions'}
          </Txt>
        </View>
        <Segments filled={rounds.done} total={rounds.goal} />
        <Txt variant="meta" tone="text2" fontSize={15} style={styles.streak}>
          {streakLine(rounds, streak)}
        </Txt>
        <View style={[styles.divider, { backgroundColor: c.line }]} />
        <Txt variant="h3" fontSize={18} style={styles.askHead}>
          {"Who's asking?"}
        </Txt>
        <Segmented
          label="Attending persona"
          options={PERSONA_OPTIONS}
          value={persona}
          onChange={setPersona}
        />
        <Button
          hero
          label="Pimp me"
          icon={LadderIcon}
          accessibilityHint={
            scripts.length > 0
              ? `Starts a ${PERSONAS[persona].label} session on a topic chosen for you`
              : undefined
          }
          disabled={scripts.length === 0}
          onPress={pimpMe}
          style={styles.pimp}
        />
        {scripts.length === 0 && (
          <Txt variant="small" tone="text2" style={styles.empty}>
            No approved scripts yet. Run `pnpm content:seed && pnpm db:reset` locally.
          </Txt>
        )}
      </Panel>

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
  title: { marginTop: space.md },
  sub: { flexDirection: 'row', marginTop: space.sm },
  hero: { marginTop: space.section, borderRadius: radius.hero },
  roundsHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: space.md,
  },
  streak: { marginTop: space.md },
  divider: { height: 1, marginVertical: space.xl },
  askHead: { marginBottom: space.md },
  pimp: { marginTop: space.lg },
  empty: { marginTop: space.md },
});
