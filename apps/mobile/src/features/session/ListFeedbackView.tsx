/** List-question feedback. Wireframe 06, mockup list.png: partial credit, real gaps. */
import type { GradeResult, Question } from '@rounds/shared';
import { StyleSheet, View } from 'react-native';
import { space } from '@/theme';
import { Button } from '@/ui/controls';
import { AnswerPill } from '@/ui/progress';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Text';
import { SessionHeader } from './SessionHeader';

export function ListFeedbackView({
  personaLabel,
  clockMs,
  scriptName,
  rungNumber,
  question,
  result,
  last,
  onNext,
  onClose,
}: {
  personaLabel: string;
  clockMs: number;
  scriptName: string;
  rungNumber: number;
  question: Extract<Question, { kind: 'list' }>;
  result: GradeResult;
  /** No more questions: the button leads to the result. */
  last: boolean;
  onNext: () => void;
  onClose: () => void;
}) {
  const named = new Set(result.matched);
  const got = question.accepted_answers.filter((a) => named.has(a.answer));
  const missed = question.accepted_answers.filter((a) => !named.has(a.answer));
  const full = got.length >= question.required_count;

  return (
    <Screen
      footer={<Button label={last ? 'See result' : 'Next question'} onPress={onNext} />}
    >
      <SessionHeader title={personaLabel} clockMs={clockMs} onClose={onClose} />
      <Txt variant="meta" tone="text2" fontSize={16} style={styles.where}>
        {scriptName}, rung {rungNumber}
      </Txt>
      <Txt variant="question" accessibilityRole="header" style={styles.prompt}>
        {question.prompt}
      </Txt>

      <View
        accessible
        accessibilityLabel={`${got.length} of ${question.required_count}. ${full ? 'You climb.' : 'Partial credit. You climb.'}`}
        style={styles.score}
      >
        <Txt variant="scoreHero" tone="signal" fontSize={64} lineHeight={64} tabular>
          {got.length}
        </Txt>
        <Txt variant="h1" tone="text2" fontSize={34} tabular style={styles.of}>
          / {question.required_count}
        </Txt>
        <Txt variant="meta" tone="text2" fontSize={16} style={styles.note}>
          {full ? 'You climb.' : 'Partial credit. You climb.'}
        </Txt>
      </View>

      <View style={styles.pills}>
        {got.map((a) => (
          <AnswerPill key={a.answer} text={a.answer} got />
        ))}
        {missed.map((a) => (
          <AnswerPill key={a.answer} text={a.answer} got={false} />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  where: { marginTop: space.xxl + space.sm },
  prompt: { marginTop: space.sm },
  score: { flexDirection: 'row', alignItems: 'flex-end', marginTop: space.xxl, gap: 8 },
  of: { marginBottom: 6 },
  note: { marginBottom: 10, marginLeft: 8, flexShrink: 1 },
  pills: { gap: 10, marginTop: space.xxl },
});
