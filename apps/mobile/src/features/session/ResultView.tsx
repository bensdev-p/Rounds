/**
 * Session result. Wireframes 07 and 13, mockups result.png and win.png. The
 * rung reached is the only score. Progress shows here, never mid-session.
 */
import type { MissCard, ResultSummary } from '@rounds/shared';
import { Flag } from 'lucide-react-native';
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
  inReview,
  summary,
  missCard,
  personaLine,
  mastery,
  saveFailed,
  onReviewScript,
  onReportProblem,
  onDone,
  onPrimary,
  primaryLabel,
}: {
  scriptName: string;
  /** In-review script (local preview): the miss card says it isn't reviewed yet. */
  inReview: boolean;
  summary: ResultSummary;
  missCard: MissCard | null;
  personaLine: string | null;
  /** Clean runs: "Internal medicine: 15 of 30 mastered". */
  mastery: { rotation: string; mastered: number; total: number } | null;
  saveFailed: boolean;
  onReviewScript: () => void;
  /** Opens the "This is wrong" sheet. */
  onReportProblem: () => void;
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
        <Ladder states={rungStates(summary.score, clean ? 'none' : 'miss')} width={150} />
        <View
          accessible
          accessibilityLabel={`${clean ? 'Top of the ladder' : `${plural(summary.score, 'rung')} climbed`}. ${bestLine(summary)}`}
          style={styles.score}
        >
          <Txt variant="scoreHero" tone={clean ? 'pass' : 'text'} tabular>
            {shown}
          </Txt>
          <Txt variant="meta" tone="text2" style={styles.scoreLine}>
            {clean ? 'Top of the ladder' : 'rungs climbed'}
          </Txt>
          <Txt variant="small" tone="text2" style={styles.bestLine}>
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
        <Txt variant="body" tone="text2" fontSize={15} lineHeight={21} style={styles.line}>
          {`"${personaLine}"`}
        </Txt>
      )}

      {missCard && (
        <Panel style={styles.card}>
          <Txt variant="small" tone="text2">
            {missCard.label}
          </Txt>
          <Txt variant="body" fontSize={15} lineHeight={21} style={styles.cardText}>
            {missCard.quote ? (
              <>
                You said{' '}
                <Txt tone="miss" fontSize={15} lineHeight={21}>{`"${missCard.quote}."`}</Txt>{' '}
              </>
            ) : (
              "You didn't answer. "
            )}
            {missCard.correction}
          </Txt>
          {inReview && (
            <Txt variant="small" tone="text3">
              {"This script hasn't been reviewed yet. If this looks off, flag it."}
            </Txt>
          )}
          <Link label="Review the script" onPress={onReviewScript} />
        </Panel>
      )}

      <Panel style={[styles.progress, clean && styles.progressAfterLine]}>
        <View style={styles.half}>
          <Txt variant="small" tone="text2">
            {"Today's rounds"}
          </Txt>
          <Segments filled={summary.rounds.done} total={summary.rounds.goal} />
          <Txt variant="small" tabular>
            {roundsLine(summary)}
          </Txt>
        </View>
        <View style={styles.half}>
          <Txt variant="small" tone="text2" numberOfLines={1}>
            {nextRank ? `Toward ${nextRank}` : 'Rank'}
          </Txt>
          <Bar
            value={summary.promoted ? 1 : summary.rankAfter.progress}
            label={nextRank ? `Progress toward ${nextRank}` : 'Top rank reached'}
          />
          <Txt variant="small" tabular>
            {rankLine(summary)}
          </Txt>
        </View>
      </Panel>

      {mastery && (
        <Panel style={styles.mastery}>
          <MiniLadder best={6} />
          <Txt variant="meta" style={styles.grow}>
            {mastery.rotation}:{' '}
            <Txt variant="meta" weight="bodySemi" tabular>
              {mastery.mastered} of {mastery.total}
            </Txt>{' '}
            mastered
          </Txt>
        </Panel>
      )}

      <View style={styles.flag}>
        <Link
          label="Something wrong with a question?"
          icon={Flag}
          accessibilityHint="Report a question or answer that looks wrong"
          onPress={onReportProblem}
        />
      </View>

      {saveFailed && (
        <Txt variant="small" tone="text2" style={[styles.saveNote, { color: c.text3 }]}>
          {"This session wasn't saved, so it won't count toward progress."}
        </Txt>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-end', marginTop: space.xxl, gap: 22 },
  score: { flex: 1, paddingBottom: 4 },
  scoreLine: { marginTop: 6 },
  bestLine: { marginTop: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: 22 },
  line: { marginTop: 14 },
  card: { marginTop: space.xxl, gap: 6 },
  cardText: { marginBottom: space.xs },
  progress: {
    marginTop: space.md,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    gap: space.lg,
  },
  progressAfterLine: { marginTop: space.xl },
  half: { flex: 1, gap: 6 },
  mastery: {
    marginTop: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  // Not in the mockup: the "This is wrong" flag is a product requirement, kept small and last.
  flag: { flexDirection: 'row', marginTop: space.lg },
  grow: { flex: 1 },
  saveNote: { marginTop: space.lg },
  buttons: { flexDirection: 'row', gap: space.md },
  done: { flex: 0.8 },
  primary: { flex: 1.6 },
});
