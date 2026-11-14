/**
 * End of a mix-up drill. Not drawn in the mockups, so it reuses the result
 * screen's pieces: the run as squares, the count, the miss card for the miss
 * that ended it, and the comparison again. Drills don't count toward rounds,
 * rank or mastery, so no progress panel.
 */
import type { ComparisonRow, MissCard } from '@rounds/shared';
import { Flag } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { space, useTheme } from '@/theme';
import { Button, Link, Panel } from '@/ui/controls';
import { StepStrip, type RungState } from '@/ui/Ladder';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Text';
import { SessionHeader } from '@/features/session/SessionHeader';
import { Comparison } from './Comparison';

export function DrillResultView({
  title,
  steps,
  score,
  total,
  missCard,
  inReview,
  comparison,
  saveFailed,
  onReviewScript,
  onReportProblem,
  onDone,
  onAgain,
}: {
  title: string;
  steps: RungState[];
  score: number;
  total: number;
  missCard: MissCard | null;
  /** The missed question's script is in review (local preview). */
  inReview: boolean;
  comparison: {
    leftName: string;
    rightName: string;
    rows: readonly ComparisonRow[] | null;
    fallback: string | null;
  };
  saveFailed: boolean;
  onReviewScript: (scriptId: string) => void;
  onReportProblem: () => void;
  onDone: () => void;
  onAgain: () => void;
}) {
  const { c } = useTheme();
  const clean = score === total;
  return (
    <Screen
      footer={
        <View style={styles.buttons}>
          <Button label="Done" variant="quiet" onPress={onDone} style={styles.done} />
          <Button label="Go again" onPress={onAgain} style={styles.primary} />
        </View>
      }
    >
      <SessionHeader title={title} onClose={onDone} closeLabel="Done" />

      <View style={styles.top}>
        <StepStrip
          states={steps}
          label={`${score} of ${total} told apart${clean ? '' : `, missed question ${score + 1}`}`}
        />
        <View style={styles.score}>
          <Txt variant="scoreHero" tone={clean ? 'pass' : 'text'} tabular>
            {score}
          </Txt>
          <Txt variant="meta" tone="text2">
            {clean ? `All ${total} told apart` : `of ${total} told apart`}
          </Txt>
        </View>
      </View>

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
          <Link label="Review the script" onPress={() => onReviewScript(missCard.script_id)} />
        </Panel>
      )}

      <View style={styles.comparison}>
        <Comparison {...comparison} />
      </View>

      <View style={styles.flag}>
        <Link
          label="Something wrong with a question?"
          icon={Flag}
          accessibilityHint="Report a question or answer that looks wrong"
          onPress={onReportProblem}
        />
      </View>

      {saveFailed && (
        <Txt variant="small" style={[styles.saveNote, { color: c.text3 }]}>
          {"This drill wasn't saved, so it won't show in Review."}
        </Txt>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { marginTop: space.xxl, gap: space.lg },
  score: { gap: 2 },
  card: { marginTop: space.xxl, gap: 6 },
  cardText: { marginBottom: space.xs },
  comparison: { marginTop: space.lg },
  flag: { flexDirection: 'row', marginTop: space.lg },
  saveNote: { marginTop: space.lg },
  buttons: { flexDirection: 'row', gap: space.md },
  done: { flex: 0.8 },
  primary: { flex: 1.6 },
});
