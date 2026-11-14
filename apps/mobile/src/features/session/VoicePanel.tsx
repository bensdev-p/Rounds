/**
 * The voice answer panel: wireframe 04 note 3 and session.png. The mic circle,
 * the waveform (a flat row of dots while the attending asks; live bars once
 * the question ends; still on the miss) and the live transcript, which always
 * reserves three lines so the panel never changes height. Tapping the mic ends
 * the answer. Below it: "Type instead" and "I don't know".
 */
import { Keyboard, Mic } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { radius, space, useTheme } from '@/theme';
import { Button } from '@/ui/controls';
import { PhiWarning } from '@/ui/PhiWarning';
import { Txt } from '@/ui/Text';

/** Bar heights from the mockup (rounds.css .wave). */
const WAVE = [10, 18, 30, 22, 40, 28, 14, 34, 24, 12, 20, 8, 16, 26, 12];
const WAVE_HEIGHT = 44;
const DOT = 4;
/** Three 21 pt lines (15 pt text), as drawn. */
const TRANSCRIPT_HEIGHT = 63;

export type VoicePhase = 'asking' | 'listening' | 'grading' | 'stopped';

export function VoicePanel({
  phase,
  level,
  transcript,
  hint,
  warning,
  onEndAnswer,
  onTypeInstead,
  onDontKnow,
  dontKnowHint,
  disabled,
}: {
  phase: VoicePhase;
  /** Mic loudness, 0–1, while listening. */
  level: number;
  transcript: string;
  /** Shown in place of the transcript when there is none ("Listening…"). */
  hint: string | null;
  warning: string | null;
  onEndAnswer: () => void;
  onTypeInstead: () => void;
  onDontKnow: () => void;
  dontKnowHint: string;
  /** After a miss: everything stops while the ladder shows it. */
  disabled: boolean;
}) {
  const { c } = useTheme();
  const reduceMotion = useReduceMotion();
  const live = phase === 'listening';
  // Reduce Motion: the bars show as drawn instead of moving.
  const amount = reduceMotion ? 1 : 0.25 + 0.75 * level;

  return (
    <View style={styles.footer}>
      <View style={[styles.panel, { backgroundColor: c.surface }]}>
        <View style={styles.top}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={live ? 'Done answering' : 'Microphone'}
            accessibilityHint={live ? 'Ends your answer now' : 'Live once the question ends'}
            accessibilityState={{ disabled: !live }}
            disabled={!live}
            onPress={onEndAnswer}
            hitSlop={8}
            style={({ pressed }) => [
              styles.mic,
              { backgroundColor: c.signal, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Mic size={24} color={c.onSignal} />
          </Pressable>
          <View
            style={styles.wave}
            accessible
            accessibilityLabel={
              live
                ? 'Listening'
                : phase === 'grading'
                  ? 'Checking your answer'
                  : 'Waiting for the question to end'
            }
          >
            {WAVE.map((base, i) => {
              const height = live ? Math.max(DOT, Math.min(WAVE_HEIGHT, base * 1.2 * amount)) : DOT;
              return <View key={i} style={[styles.bar, { height, backgroundColor: c.signal }]} />;
            })}
          </View>
        </View>
        <Txt
          fontSize={15}
          lineHeight={21}
          tone={transcript ? 'text2' : 'text3'}
          numberOfLines={3}
          accessibilityLiveRegion="polite"
          style={styles.transcript}
        >
          {transcript ? `"${transcript}${phase === 'listening' ? '…' : '"'}` : (hint ?? '')}
        </Txt>
      </View>
      {warning && <PhiWarning message={warning} />}
      <View style={styles.buttons}>
        <Button
          label="Type instead"
          variant="quiet"
          compact
          icon={Keyboard}
          onPress={onTypeInstead}
          disabled={disabled}
          accessibilityHint="Answer with the keyboard for the rest of this session"
          style={styles.button}
        />
        <Button
          label="I don't know"
          variant="quiet"
          compact
          onPress={onDontKnow}
          disabled={disabled}
          accessibilityHint={dontKnowHint}
          style={styles.button}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { gap: space.md },
  panel: { borderRadius: radius.panel, paddingVertical: 16, paddingHorizontal: 18 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  mic: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 4, height: WAVE_HEIGHT },
  bar: { width: DOT, borderRadius: 2 },
  transcript: { marginTop: 12, minHeight: TRANSCRIPT_HEIGHT },
  buttons: { flexDirection: 'row', gap: 10 },
  button: { flex: 1 },
});
