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
  type Confusable,
  type GradeResult,
  type IllnessScript,
  type Question,
  type LadderState,
  type MissTag,
  type Rung,
} from '@rounds/shared';
import { getLadderContent } from '@rounds/shared/api';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/Button';
import { Disclaimer } from '@/components/Disclaimer';
import { ErrorView, Loading } from '@/components/StatusView';
import { useClient } from '@/lib/auth';
import { useAsync } from '@/lib/useAsync';
import { useLadderRecorder, type SaveState } from '@/lib/useLadderRecorder';
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
  const client = useClient();
  const { scriptId } = useLocalSearchParams<{ scriptId: string }>();
  const content = useAsync(() => getLadderContent(client, scriptId), scriptId);

  if (content.status === 'loading') return <Loading label="Loading questions" />;
  if (content.status === 'error') {
    return (
      <ErrorView
        message={`Couldn't load this script. ${content.error.message}`}
        onRetry={content.reload}
      />
    );
  }
  if (!content.data || content.data.questions.length === 0) {
    return <ErrorView message="That script isn't available." />;
  }
  return (
    <Ladder
      script={content.data.script}
      questions={content.data.questions}
      confusables={content.data.confusables}
      theme={theme}
    />
  );
}

function Ladder({
  script,
  questions,
  confusables,
  theme,
}: {
  script: IllnessScript;
  questions: Question[];
  confusables: Confusable[];
  theme: Theme;
}) {
  const client = useClient();
  const [state, setState] = useState<LadderState>(() => startLadder(questions));
  const recorder = useLadderRecorder(client, script, state.persona);
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
    const result = gradeLocally(question, answer, confusables);
    const next = submitAnswer(state, { answer, elapsed_ms: Date.now() - shownAt.current, result });
    setState(next);
    const attempt = next.attempts.at(-1);
    if (attempt) recorder.record(attempt);
    if (next.status !== 'in_progress') recorder.finish(next);
    setFeedback(result);
    setWarning(null);
    setAnswer('');
  }

  function restart() {
    recorder.reset();
    setState(startLadder(questions));
    setFeedback(null);
    setWarning(null);
    setAnswer('');
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.flex}>
      <Stack.Screen options={{ title: script.name }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <RungProgress state={state} theme={theme} />
        {recorder.save.status === 'error' && (
          <Text accessibilityRole="alert" style={[styles.warning, { color: theme.warning }]}>
            Progress not saved. You can keep going.
          </Text>
        )}

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
          <Summary
            state={state}
            script={script}
            confusables={confusables}
            save={recorder.save}
            theme={theme}
            onRestart={restart}
          />
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

function describeMiss(tag: MissTag, script: IllnessScript, confusables: Confusable[]): string {
  if (tag === 'unknown') return 'Missed.';
  if (tag === 'slow') return 'Right answer, but too slow.';
  if (tag === 'partial_list') return 'Not enough items named.';
  const otherId = tag.slice('confused_with:'.length);
  const otherName = confusables.find((c) => c.script_id === otherId)?.names[0] ?? otherId;
  const link = script.confused_with.find((c) => c.script_id === otherId);
  return link
    ? `Mixed up with ${otherName}. ${link.how_to_tell_apart}`
    : `Mixed up with ${otherName}.`;
}

function Summary({
  state,
  script,
  confusables,
  save,
  theme,
  onRestart,
}: {
  state: LadderState;
  script: IllnessScript;
  confusables: Confusable[];
  save: SaveState;
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
          {describeMiss(miss.miss_tag, script, confusables)}
        </Text>
      )}
      {missedQuestion && (
        <Text style={{ color: theme.muted, fontSize: 16 }}>
          Accepted: {missedQuestion.accepted_answers.map((a) => a.answer).join(', ')}
        </Text>
      )}
      <Text style={{ color: theme.muted, fontSize: 16 }}>
        {save.status === 'saved'
          ? `Your best on this script: ${save.bestRung} / ${RUNGS.length}`
          : save.status === 'error'
            ? 'This run was not saved.'
            : 'Saving…'}
      </Text>
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
