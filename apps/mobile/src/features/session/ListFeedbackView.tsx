/** List-question feedback. Wireframe 06, mockup list.png: partial credit, real gaps. */
import { personaLine, type GradeResult, type PersonaId, type Question } from '@rounds/shared';
import { StyleSheet, View } from 'react-native';
import { space } from '@/theme';
import { Button } from '@/ui/controls';
import { AnswerPill } from '@/ui/progress';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Text';
import { SessionHeader } from './SessionHeader';

export function ListFeedbackView({
  persona,
  personaLabel,
  clockMs,
  scriptName,
  inReview,
  rungNumber,
  question,
  result,
  last,
  onNext,
  onClose,
}: {
  /** For the attending's one-line comment under the answers. */
  persona: PersonaId;
  personaLabel: string;
  clockMs: number;
  scriptName: string;
  inReview: boolean;
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
    <Screen footer={<Button label={last ? 'See result' : 'Next question'} onPress={onNext} />}>
      <SessionHeader title={personaLabel} clockMs={clockMs} onClose={onClose} />
      <Txt variant="meta" tone="text2" style={styles.where}>
        {scriptName}, rung {rungNumber}
        {inReview && (
          <Txt variant="meta" tone="text3">
            {'  ·  Not yet reviewed'}
          </Txt>
        )}
      </Txt>
      <Txt variant="question" accessibilityRole="header" style={styles.prompt}>
        {question.prompt}
      </Txt>

      <View
        accessible
        accessibilityLabel={`${got.length} of ${question.required_count}. ${full ? 'You climb.' : 'Partial credit. You climb.'}`}
        style={styles.score}
      >
        <Txt variant="scoreHero" tone="signal" fontSize={56} lineHeight={56} tabular>
          {got.length}
        </Txt>
        <Txt variant="h1" tone="text3" fontSize={28} lineHeight={30} tabular style={styles.of}>
          / {question.required_count}
        </Txt>
        <Txt variant="meta" tone="text2" style={styles.note}>
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

      <Txt variant="body" tone="text2" fontSize={15} lineHeight={21} style={styles.line}>
        {`"${personaLine(persona, full ? 'list_full' : 'list_partial', rungNumber)}"`}
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  where: { marginTop: space.section },
  prompt: { marginTop: space.sm },
  score: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 22, gap: 8 },
  of: { marginBottom: 4 },
  note: { marginBottom: 6, marginLeft: 8, flexShrink: 1 },
  pills: { gap: 8, marginTop: 18 },
  line: { marginTop: 18 },
});
