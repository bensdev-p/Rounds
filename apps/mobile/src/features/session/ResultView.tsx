/**
 * Session result. Wireframes 07 and 13, mockups result.png and win.png. The
 * rung reached is the only score. Progress shows here, never mid-session.
 */
import type { MissCard, ResultSummary } from '@rounds/shared';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { plural } from '@/lib/copy';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { space, useTheme } from '@/theme';
import { Button, Link, Panel } from '@/ui/controls';
import { Ladder, rungStates } from '@/ui/Ladder';
import { Badge, Bar, MiniLadder, Segments } from '@/ui/progress';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Text';
import { SessionHeader } from './SessionHeader';

/** The score counts up once, under 600 ms. */
function useCountUp(to: number): number {
  const reduceMotion = useReduceMotion();
  const [value, setValue] = useState(0);
  useEffect(() => {
    let n = 0;
    const timer = setInterval(
      () => {
        n += 1;
        setValue(Math.min(n, to));
        if (n >= to) clearInterval(timer);
      },
      Math.max(60, Math.floor(480 / Math.max(to, 1))),
    );
    return () => clearInterval(timer);
  }, [to]);
  return reduceMotion ? to : value;
}

function bestLine(r: ResultSummary): string {
  if (r.newBest) return `New best (was ${r.previousBest})`;
  if (r.previousBest === null) return 'First time on this topic';
  return `Your best here is ${Math.max(r.previousBest, r.score)}`;
}

function rankLine(r: ResultSummary): string {
  if (r.promoted) return `+${plural(r.score, 'rung')}. ${r.rankAfter.title}`;
  if (r.rankAfter.toNext === null) return `+${plural(r.score, 'rung')}`;
  return `+${plural(r.score, 'rung')}, ${r.rankAfter.toNext.toLocaleString('en-US')} to go`;
}

function roundsLine(r: ResultSummary): string {
  if (!r.rounds.complete) return `${Math.min(r.rounds.done, r.rounds.goal)} of ${r.rounds.goal}`;
  return r.streak.count > 1 ? `Done. ${r.streak.count} shifts in a row` : 'Done';
}

export function ResultView({
  scriptName,
  summary,
  missCard,
  personaLine,
  mastery,
  saveFailed,
  onReviewScript,
  onDone,
  onPrimary,
  primaryLabel,
}: {
  scriptName: string;
  summary: ResultSummary;
  missCard: MissCard | null;
  personaLine: string | null;
  /** Clean runs: "Internal medicine: 15 of 30 mastered". */
  mastery: { rotation: string; mastered: number; total: number } | null;
  saveFailed: boolean;
  onReviewScript: () => void;
  onDone: () => void;
  onPrimary: () => void;
  primaryLabel: string;
}) {
  const { c } = useTheme();
  const shown = useCountUp(summary.score);
  const clean = summary.completed;
  const nextRank = summary.promoted ? summary.rankAfter.title : summary.rankAfter.next?.title;

  return (
    <Screen
      footer={
        <View style={styles.buttons}>
          <Button label="Done" variant="quiet" onPress={onDone} style={styles.done} />
          <Button label={primaryLabel} onPress={onPrimary} style={styles.primary} />
        </View>
      }
    >
      <SessionHeader title={scriptName} onClose={onDone} closeLabel="Done" />

      <View style={styles.top}>
        <Ladder
          states={rungStates(summary.score, clean ? 'none' : 'miss')}
          width={170}
        />
        <View
          accessible
          accessibilityLabel={`${clean ? 'Top of the ladder' : `${plural(summary.score, 'rung')} climbed`}. ${bestLine(summary)}`}
          style={styles.score}
        >
          <Txt variant="scoreHero" tone={clean ? 'pass' : 'text'} tabular>
            {shown}
          </Txt>
          <Txt variant="body" tone="text2" fontSize={17} style={styles.scoreLine}>
            {clean ? 'Top of the ladder' : 'rungs climbed'}
          </Txt>
          <Txt variant="meta" tone="text2" fontSize={15}>
            {bestLine(summary)}
          </Txt>
        </View>
      </View>

      {summary.badges.length > 0 && (
        <View style={styles.badges}>
          {summary.badges.map((b) => (
            <Badge key={b} id={b} />
          ))}
        </View>
      )}

      {personaLine && (
        <Txt variant="body" tone="text2" fontSize={17} lineHeight={24} style={styles.line}>
          {`"${personaLine}"`}
        </Txt>
      )}

      {missCard && (
        <Panel style={styles.card}>
          <Txt variant="meta" tone="text2">
            {missCard.label}
          </Txt>
          <Txt variant="body" fontSize={17} lineHeight={24} style={styles.cardText}>
            {missCard.quote ? (
              <>
                You said <Txt tone="miss" fontSize={17} lineHeight={24}>{`"${missCard.quote}."`}</Txt>{' '}
              </>
            ) : (
              "You didn't answer. "
            )}
            {missCard.correction}
          </Txt>
          <Link label="Review the script" onPress={onReviewScript} />
        </Panel>
      )}

      <Panel style={styles.progress}>
        <View style={styles.half}>
          <Txt variant="meta" tone="text2" fontSize={15}>
            {"Today's rounds"}
          </Txt>
          <Segments filled={summary.rounds.done} total={summary.rounds.goal} />
          <Txt variant="meta" fontSize={15} tabular>
            {roundsLine(summary)}
          </Txt>
        </View>
        <View style={styles.half}>
          <Txt variant="meta" tone="text2" fontSize={15} numberOfLines={1}>
            {nextRank ? `Toward ${nextRank}` : 'Rank'}
          </Txt>
          <Bar
            value={summary.promoted ? 1 : summary.rankAfter.progress}
            label={nextRank ? `Progress toward ${nextRank}` : 'Top rank reached'}
          />
          <Txt variant="meta" fontSize={15} tabular>
            {rankLine(summary)}
          </Txt>
        </View>
      </Panel>

      {mastery && (
        <Panel style={styles.mastery}>
          <MiniLadder best={6} />
          <Txt variant="body" fontSize={17} style={styles.grow}>
            {mastery.rotation}:{' '}
            <Txt weight="bodySemi" fontSize={17} tabular>
              {mastery.mastered} of {mastery.total}
            </Txt>{' '}
            mastered
          </Txt>
        </Panel>
      )}

      {saveFailed && (
        <Txt variant="small" tone="text2" style={[styles.saveNote, { color: c.text3 }]}>
          {"This session wasn't saved, so it won't count toward progress."}
        </Txt>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-end', marginTop: space.xxl, gap: space.lg },
  score: { flex: 1, paddingBottom: 4 },
  scoreLine: { marginTop: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.xxl },
  line: { marginTop: space.lg },
  card: { marginTop: space.xxl, gap: space.sm },
  cardText: { marginBottom: space.xs },
  progress: { marginTop: space.lg, flexDirection: 'row', gap: space.xxl },
  half: { flex: 1, gap: 10 },
  mastery: { marginTop: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.lg },
  grow: { flex: 1 },
  saveNote: { marginTop: space.lg },
  buttons: { flexDirection: 'row', gap: space.md },
  done: { flex: 0.8 },
  primary: { flex: 1.6 },
});
