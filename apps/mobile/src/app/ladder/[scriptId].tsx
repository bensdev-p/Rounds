import {
  currentQuestion,
  detectPhi,
  endingMiss,
  gradeLocally,
  ladderScore,
  phiWarning,
  RUNGS,
  startLadder,
  submitAnswer,
  type GradeResult,
  type IllnessScript,
  type LadderState,
  type MissTag,
  type Rung,
} from '@rounds/shared';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/Button';
import { Disclaimer } from '@/components/Disclaimer';
import { getConfusables, getQuestions, getScript } from '@/lib/content';
import { space, useTheme, type Theme } from '@/theme';

const RUNG_LABEL: Record<Rung, string> = {
  recall: 'Recall',
  second_order: 'Second-order',
  differentiate: 'Differentiate',
  workup: 'Workup',
  management: 'Management',
  pearl: 'Pearl',
};

export default function LadderScreen() {
  const theme = useTheme();
  const { scriptId } = useLocalSearchParams<{ scriptId: string }>();
  const script = getScript(scriptId);

  if (!script) {
    return (
      <View style={styles.container}>
        <Text style={{ color: theme.text }}>That script isn&apos;t available.</Text>
      </View>
    );
  }
  return <Ladder script={script} theme={theme} />;
}

function Ladder({ script, theme }: { script: IllnessScript; theme: Theme }) {
  const [state, setState] = useState<LadderState>(() => startLadder(getQuestions(script.id)));
  const [answer, setAnswer] = useState('');
  const [warning, setWarning] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<GradeResult | null>(null);
  // When the current question appeared, for the persona time limit.
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = Date.now();
  }, [state]);

  const question = currentQuestion(state);

  function submit() {
    if (!question || !answer.trim()) return;
    const phi = phiWarning(detectPhi(answer));
    if (phi) {
      setWarning(phi);
      return;
    }
    const result = gradeLocally(question, answer, getConfusables(script));
    setState((s) => submitAnswer(s, { answer, elapsed_ms: Date.now() - shownAt.current, result }));
    setFeedback(result);
    setWarning(null);
    setAnswer('');
  }

  function restart() {
    setState(startLadder(getQuestions(script.id)));
    setFeedback(null);
    setWarning(null);
    setAnswer('');
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.flex}>
      <Stack.Screen options={{ title: script.name }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <RungProgress state={state} theme={theme} />

        {feedback && (
          <Text
            accessibilityLiveRegion="polite"
            style={[
              styles.feedback,
              { color: state.attempts.at(-1)?.passed ? theme.success : theme.danger },
            ]}
          >
            {feedback.reason}
          </Text>
        )}

        {question ? (
          <View style={styles.gap}>
            <Text style={[styles.rung, { color: theme.muted }]}>{RUNG_LABEL[question.rung]}</Text>
            <Text accessibilityRole="header" style={[styles.prompt, { color: theme.text }]}>
              {question.prompt}
            </Text>
            <TextInput
              accessibilityLabel="Your answer"
              accessibilityHint={
                question.kind === 'list'
                  ? 'Separate items with commas'
                  : 'Type your answer, then submit'
              }
              value={answer}
              onChangeText={(text) => {
                setAnswer(text);
                if (warning) setWarning(null);
              }}
              onSubmitEditing={submit}
              placeholder={question.kind === 'list' ? 'item, item, item' : 'Your answer'}
              placeholderTextColor={theme.muted}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              maxLength={500}
              returnKeyType="send"
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
              ]}
            />
            {warning && (
              <Text accessibilityRole="alert" style={[styles.warning, { color: theme.warning }]}>
                {warning}
              </Text>
            )}
            <Button label="Submit" onPress={submit} disabled={!answer.trim()} />
          </View>
        ) : (
          <Summary state={state} script={script} theme={theme} onRestart={restart} />
        )}

        <Disclaimer />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function RungProgress({ state, theme }: { state: LadderState; theme: Theme }) {
  const score = ladderScore(state);
  return (
    <View
      accessible
      accessibilityLabel={`Rung ${score} of ${RUNGS.length} cleared`}
      style={styles.progress}
    >
      {RUNGS.map((rung, i) => (
        <View
          key={rung}
          style={[styles.pip, { backgroundColor: i < score ? theme.success : theme.border }]}
        />
      ))}
    </View>
  );
}

function describeMiss(tag: MissTag, script: IllnessScript): string {
  if (tag === 'unknown') return 'Missed.';
  if (tag === 'slow') return 'Right answer, but too slow.';
  if (tag === 'partial_list') return 'Not enough items named.';
  const otherId = tag.slice('confused_with:'.length);
  const otherName =
    getConfusables(script).find((c) => c.script_id === otherId)?.names[0] ?? otherId;
  const link = script.confused_with.find((c) => c.script_id === otherId);
  return link
    ? `Mixed up with ${otherName}. ${link.how_to_tell_apart}`
    : `Mixed up with ${otherName}.`;
}

function Summary({
  state,
  script,
  theme,
  onRestart,
}: {
  state: LadderState;
  script: IllnessScript;
  theme: Theme;
  onRestart: () => void;
}) {
  const score = ladderScore(state);
  const miss = endingMiss(state);
  const missedQuestion = miss ? state.questions.find((q) => q.id === miss.question_id) : null;

  return (
    <View style={styles.gap} accessibilityLiveRegion="polite">
      <Text accessibilityRole="header" style={[styles.prompt, { color: theme.text }]}>
        {state.status === 'completed' ? 'Top of the ladder.' : 'Ladder over.'}
      </Text>
      <Text style={[styles.score, { color: theme.text }]}>
        Score: {score} / {RUNGS.length}
      </Text>
      {miss?.miss_tag && (
        <Text style={{ color: theme.muted, fontSize: 16 }}>
          {describeMiss(miss.miss_tag, script)}
        </Text>
      )}
      {missedQuestion && (
        <Text style={{ color: theme.muted, fontSize: 16 }}>
          Accepted: {missedQuestion.accepted_answers.map((a) => a.answer).join(', ')}
        </Text>
      )}
      <Button label="Pimp me again" onPress={onRestart} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: space.md, gap: space.md },
  gap: { gap: space.sm },
  progress: { flexDirection: 'row', gap: space.xs },
  pip: { flex: 1, height: 6, borderRadius: 3 },
  feedback: { fontSize: 16, fontWeight: '600' },
  rung: { fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 },
  prompt: { fontSize: 22, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, padding: space.md, fontSize: 18, minHeight: 52 },
  warning: { fontSize: 15 },
  score: { fontSize: 20, fontWeight: '700' },
});
