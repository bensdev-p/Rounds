/**
 * Live session, text mode. Wireframe 05, mockup session.png. Mid-session the
 * screen shows the ladder and the question and nothing else: no feedback text,
 * no progress. The question is replaced in place; it never pushes the ladder.
 */
import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { useKeyboardVisible } from '@/lib/useKeyboardVisible';
import { radius, space, type, useTheme } from '@/theme';
import { Button } from '@/ui/controls';
import { Ladder, LadderStrip, type RungState } from '@/ui/Ladder';
import { PhiWarning } from '@/ui/PhiWarning';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Text';
import { noWebOutline } from '@/ui/webStyles';
import { SessionHeader } from './SessionHeader';

export function AskingView({
  personaLabel,
  clockMs,
  rungs,
  scriptName,
  inReview,
  prompt,
  isList,
  answer,
  onChangeAnswer,
  onSubmit,
  onDontKnow,
  onClose,
  grading,
  locked,
  warning,
}: {
  personaLabel: string;
  clockMs: number;
  rungs: RungState[];
  scriptName: string;
  /** In-review script (local preview): show "Not yet reviewed". */
  inReview: boolean;
  prompt: string;
  isList: boolean;
  answer: string;
  onChangeAnswer: (text: string) => void;
  onSubmit: () => void;
  onDontKnow: () => void;
  onClose: () => void;
  grading: boolean;
  /** After a miss: everything stops while the ladder shows it. */
  locked: boolean;
  warning: string | null;
}) {
  const { c } = useTheme();
  const keyboard = useKeyboardVisible();
  const busy = grading || locked;
  const [focused, setFocused] = useState(false);

  const footer = (
    <View style={styles.footer}>
      <TextInput
        accessibilityLabel="Your answer"
        accessibilityHint={isList ? 'Separate items with commas' : 'Type your answer, then submit'}
        value={answer}
        onChangeText={onChangeAnswer}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSubmitEditing={onSubmit}
        onKeyPress={(e) => {
          // Web: Enter submits, Shift+Enter adds a line (native uses the return key).
          const key = e.nativeEvent as unknown as { key: string; shiftKey?: boolean };
          if (Platform.OS === 'web' && key.key === 'Enter' && !key.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
        submitBehavior="submit"
        editable={!busy}
        placeholder={isList ? 'Type your answers, separated by commas' : 'Type your answer'}
        placeholderTextColor={c.text3}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        multiline
        maxLength={500}
        returnKeyType="send"
        style={[
          styles.input,
          type('body'),
          noWebOutline,
          {
            color: c.text,
            backgroundColor: c.surface,
            borderColor: warning ? c.miss : focused ? c.ceil : c.line,
          },
        ]}
      />
      {warning && <PhiWarning message={warning} />}
      <View style={styles.buttons}>
        <Button
          label="I don't know"
          variant="quiet"
          onPress={onDontKnow}
          disabled={busy}
          accessibilityHint="Ends the session on this rung"
          style={styles.dontKnow}
        />
        <Button
          label={grading ? 'Grading…' : 'Submit'}
          onPress={onSubmit}
          disabled={busy || !answer.trim()}
          style={styles.submit}
        />
      </View>
    </View>
  );

  return (
    <Screen footer={footer}>
      <SessionHeader title={personaLabel} clockMs={clockMs} onClose={onClose} />
      <View style={styles.ladder}>
        {keyboard ? <LadderStrip states={rungs} /> : <Ladder states={rungs} />}
      </View>
      <Txt variant="meta" tone="text2" style={styles.script}>
        {scriptName}
        {inReview && (
          <Txt variant="meta" tone="text3">
            {'  ·  Not yet reviewed'}
          </Txt>
        )}
      </Txt>
      <Txt
        variant="question"
        accessibilityRole="header"
        accessibilityLiveRegion="polite"
        style={styles.question}
      >
        {prompt}
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ladder: { marginTop: space.section },
  script: { marginTop: 30 },
  question: { marginTop: space.sm },
  footer: { gap: space.md },
  input: {
    minHeight: 88,
    maxHeight: 140,
    borderWidth: 1.5,
    borderRadius: radius.field,
    paddingHorizontal: space.lg,
    paddingTop: 14,
    paddingBottom: 14,
    textAlignVertical: 'top',
  },
  buttons: { flexDirection: 'row', gap: space.md },
  dontKnow: { flex: 1 },
  submit: { flex: 1.25 },
});
