/**
 * "This is wrong" sheet (PRODUCT.md: each question has a flag that feeds a
 * review queue). Slides up over the result or script screen. The student
 * picks the question (if there's a choice), a reason and an optional note.
 */
import {
  detectPhi,
  FLAG_REASON_LABELS,
  MAX_FLAG_NOTE_LENGTH,
  phiWarning,
  type FlagReason,
} from '@rounds/shared';
import { flagContent } from '@rounds/shared/api';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClient } from '@/lib/auth';
import { radius, size, space, type, useTheme } from '@/theme';
import { Button } from '@/ui/controls';
import { PhiWarning } from '@/ui/PhiWarning';
import { Txt } from '@/ui/Text';
import { noWebOutline } from '@/ui/webStyles';

export interface FlagTarget {
  script: { id: string; version: number; name: string };
  /** Questions to choose from; empty to flag the whole script. */
  questions: readonly { id: string; prompt: string }[];
  /** Preselected question, e.g. the one that ended the session. */
  initialQuestionId?: string | undefined;
  reasons: readonly FlagReason[];
}

type Status = 'editing' | 'sending' | 'sent' | 'error';

function Choice({
  label,
  selected,
  onPress,
  lines = 1,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  lines?: number;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        { backgroundColor: selected ? c.ceilSoft : c.surface2, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.radio, { borderColor: selected ? c.ceil : c.text3 }]}>
        {selected && <View style={[styles.dot, { backgroundColor: c.ceil }]} />}
      </View>
      <Txt variant="meta" fontSize={15} numberOfLines={lines} style={styles.grow}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function FlagSheet({
  target,
  onClose,
}: {
  /** null hides the sheet. */
  target: FlagTarget | null;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const client = useClient();
  const [questionId, setQuestionId] = useState<string | null>(null);
  const [reason, setReason] = useState<FlagReason | null>(null);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<Status>('editing');
  // Reset the form whenever the sheet opens for a new target.
  const [shownFor, setShownFor] = useState<FlagTarget | null>(null);
  if (target !== shownFor) {
    setShownFor(target);
    setQuestionId(target?.initialQuestionId ?? target?.questions[0]?.id ?? null);
    setReason(target?.reasons.length === 1 ? (target.reasons[0] ?? null) : null);
    setNote('');
    setStatus('editing');
  }

  const phi = phiWarning(detectPhi(note, { checkNames: true }));

  async function send() {
    if (!target || !reason || phi) return;
    setStatus('sending');
    try {
      await flagContent(client, {
        script_id: target.script.id,
        question_id: target.questions.length > 0 ? questionId : null,
        script_version: target.script.version,
        reason,
        note: note.trim() ? note.trim() : null,
      });
      setStatus('sent');
    } catch (error) {
      console.warn('[rounds] flag failed', error);
      setStatus('error');
    }
  }

  return (
    <Modal
      visible={target !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Close"
          accessibilityRole="button"
          onPress={onClose}
        />
        <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: c.surface }]}>
          {status === 'sent' ? (
            <View style={styles.sent} accessibilityLiveRegion="polite">
              <Txt variant="h2">Thanks, flagged for review.</Txt>
              <Txt variant="meta" tone="text2">
                {
                  "The reviewer will check it against the script. Nothing changes until they've looked."
                }
              </Txt>
              <Button label="Done" variant="quiet" onPress={onClose} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              <Txt variant="h2" accessibilityRole="header">
                {"What's wrong?"}
              </Txt>
              <Txt variant="meta" tone="text2">
                {target?.script.name}
              </Txt>

              {target && target.questions.length > 1 && (
                <View
                  style={styles.group}
                  accessibilityRole="radiogroup"
                  accessibilityLabel="Question"
                >
                  <Txt variant="h3" fontSize={16}>
                    Which question?
                  </Txt>
                  {target.questions.map((q) => (
                    <Choice
                      key={q.id}
                      label={q.prompt}
                      lines={2}
                      selected={questionId === q.id}
                      onPress={() => setQuestionId(q.id)}
                    />
                  ))}
                </View>
              )}

              <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="Reason">
                <Txt variant="h3" fontSize={16}>
                  Reason
                </Txt>
                {target?.reasons.map((r) => (
                  <Choice
                    key={r}
                    label={FLAG_REASON_LABELS[r]}
                    selected={reason === r}
                    onPress={() => setReason(r)}
                  />
                ))}
              </View>

              <TextInput
                accessibilityLabel="Note, optional"
                value={note}
                onChangeText={setNote}
                placeholder="Add a note (optional)"
                placeholderTextColor={c.text3}
                multiline
                maxLength={MAX_FLAG_NOTE_LENGTH}
                style={[
                  styles.note,
                  type('body'),
                  noWebOutline,
                  { color: c.text, backgroundColor: c.bg, borderColor: phi ? c.miss : c.line },
                ]}
              />
              {phi && <PhiWarning message={phi} />}
              {status === 'error' && (
                <Txt variant="meta" tone="miss" accessibilityRole="alert">
                  {"Couldn't send. Check the connection and try again."}
                </Txt>
              )}

              <View style={styles.buttons}>
                <Button label="Cancel" variant="quiet" onPress={onClose} style={styles.cancel} />
                <Button
                  label={status === 'sending' ? 'Sending…' : 'Send'}
                  variant="line"
                  onPress={() => void send()}
                  disabled={!reason || Boolean(phi) || status === 'sending'}
                  style={styles.send}
                />
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    maxHeight: '88%',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
  },
  body: { padding: space.xl, gap: space.md },
  sent: { padding: space.xl, gap: space.lg },
  group: { gap: space.sm, marginTop: space.sm },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: size.minTouch,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.row,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  grow: { flex: 1 },
  note: {
    minHeight: 72,
    borderWidth: 1.5,
    borderRadius: radius.field,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    textAlignVertical: 'top',
    marginTop: space.sm,
  },
  buttons: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
  cancel: { flex: 1 },
  send: { flex: 1 },
});
