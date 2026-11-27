/**
 * Live session, text mode. Wireframe 05, mockup session.png. Mid-session the
 * screen shows the ladder and the question and nothing else: no feedback text,
 * no progress. The question is replaced in place; it never pushes the ladder.
 */
import type { ClockReading } from '@rounds/shared';
import { useState, type ReactNode } from 'react';
import { PixelRatio, Platform, StyleSheet, TextInput, View } from 'react-native';
import { useKeyboardVisible } from '@/lib/useKeyboardVisible';
import { radius, space, type, useTheme } from '@/theme';
import { Button } from '@/ui/controls';
import { Ladder, LadderStrip, StepStrip, type RungState } from '@/ui/Ladder';
import { PhiWarning } from '@/ui/PhiWarning';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Text';
import { noWebOutline } from '@/ui/webStyles';
import { SessionHeader } from './SessionHeader';

export function AskingView({
  personaLabel,
  clock,
  rungs,
  steps,
  dontKnowHint = 'Ends the session on this rung',
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
  notice = null,
  voice,
}: {
  personaLabel: string;
  clock: Pick<ClockReading, 'mode' | 'text'>;
  /** The six-rung ladder. Ignored when `steps` is given. */
  rungs: RungState[];
  /** A short run instead of the ladder (the mix-up drill): squares and their spoken label. */
  steps?: { states: RungState[]; label: string };
  dontKnowHint?: string;
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
  /** One line above the answer box, e.g. why the session is in text mode. */
  notice?: string | null;
  /** Voice mode (wireframe 04): the voice panel replaces the answer box. */
  voice?: ReactNode;
}) {
  const { c } = useTheme();
  const keyboard = useKeyboardVisible();
  const busy = grading || locked;
  const [focused, setFocused] = useState(false);
  // Voice mode: a question over three lines would run under the voice panel,
  // so the ladder collapses to its strip, as it does for the keyboard
  // (wireframe 05 note 1; developer's call, M2.5). Measured per question.
  const [longPrompt, setLongPrompt] = useState<string | null>(null);
  const collapsed = voice ? longPrompt === prompt : keyboard;

  const footer = (
    <View style={styles.footer}>
      {notice && (
        <Txt variant="small" tone="text2">
          {notice}
        </Txt>
      )}
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
          accessibilityHint={dontKnowHint}
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
    <Screen footer={voice ?? footer}>
      <SessionHeader title={personaLabel} clock={clock} onClose={onClose} />
      <View style={styles.ladder}>
        {steps ? (
          <StepStrip states={steps.states} label={steps.label} />
        ) : collapsed ? (
          <LadderStrip states={rungs} />
        ) : (
          <Ladder states={rungs} />
        )}
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
        onLayout={(e) => {
          if (!voice) return;
          // The question's line height, scaled with Dynamic Type.
          const line = type('question').lineHeight! * PixelRatio.getFontScale();
          const long = e.nativeEvent.layout.height > line * 3.5;
          setLongPrompt((current) => (long ? prompt : current === prompt ? null : current));
        }}
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
