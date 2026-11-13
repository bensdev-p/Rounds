import { MISSED_RUNG, STEPS, TRANSCRIPT_FRAMES_PER_WORD } from '../session.ts';
import { color, num, radius } from '../theme.ts';
import {
  BEATS,
  FPS,
  MISS_FRAME,
  POSTER_FRAME,
  RUNG_PASSES,
  SESSION_START,
  ramp,
  rungPass,
  wordsShown,
} from '../timeline.ts';
import {
  Button,
  Icon,
  LADDER_LABELS,
  Ladder,
  RUNG_DIM,
  type RungVisual,
  Screen,
  SessionHeader,
  Words,
  text,
} from '../ui.tsx';

/* Live session (mockup: session.png). The session and climb scenes share this
   screen. The ladder climbs rung by rung and ends on the first miss. */

const WAVE = [10, 18, 30, 22, 40, 28, 14, 34, 24, 12, 20, 8, 16, 26, 12];

// The clock reads 0:42 on the poster frame, as on the mockup.
const TIMER_START_SECONDS = 42 - Math.floor((POSTER_FRAME - SESSION_START) / FPS);

const rungAt = (frame: number, index: number): RungVisual => {
  // Rungs above the miss are never reached.
  if (index >= MISSED_RUNG) return RUNG_DIM;
  const becameCurrent = index === 0 ? null : (RUNG_PASSES[index - 1] ?? null);
  if (becameCurrent !== null && frame < becameCurrent) return RUNG_DIM;

  // The amber pop for the rung that has just become current.
  const pop = becameCurrent === null ? { fill: 1, pop: 1 } : rungPass(frame, becameCurrent);
  const now = { now: pop.fill, scale: 0.7 + 0.3 * pop.pop };

  if (index === MISSED_RUNG - 1) {
    const miss = ramp(frame, MISS_FRAME, 6);
    return { ...now, done: 0, miss, label: miss > 0 ? 'miss' : 'now' };
  }
  const passedAt = RUNG_PASSES[index];
  const done = passedAt === undefined ? 0 : rungPass(frame, passedAt).fill;
  return { ...now, done, miss: 0, label: done > 0 ? 'done' : 'now' };
};

const clock = (frame: number): string => {
  // The clock stops on the miss.
  const elapsed = Math.max(0, Math.min(frame, MISS_FRAME) - SESSION_START);
  const seconds = TIMER_START_SECONDS + Math.floor(elapsed / FPS);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** `frame` is the global frame. */
export const SessionScreen = ({ frame }: { frame: number }) => {
  const stepIndex = Math.min(STEPS.length - 1, RUNG_PASSES.filter((at) => frame >= at).length);
  const step = STEPS[stepIndex];
  const beat = BEATS[stepIndex];
  if (!step || !beat) return null;

  // The mic goes live once the attending has finished asking, and stops on the miss.
  const live = ramp(frame, beat.questionEnd, 6) * (1 - ramp(frame, MISS_FRAME, 6));

  return (
    <Screen padding="8px 20px 28px">
      <SessionHeader
        title="Internist"
        right={<span style={{ ...num, fontSize: 18, color: color.text2 }}>{clock(frame)}</span>}
      />
      <div style={{ marginTop: 26 }}>
        <Ladder rungs={LADDER_LABELS.map((_, i) => rungAt(frame, i))} width={190} />
      </div>
      <div style={{ marginTop: 30 }}>
        <div style={text.meta}>Acute pancreatitis</div>
        <div style={{ ...text.question, marginTop: 8 }}>
          <Words value={step.question} shown={wordsShown(frame, beat.questionStart)} />
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ background: color.surface, borderRadius: radius.panel, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: color.signal,
              color: color.onSignal,
              display: 'grid',
              placeItems: 'center',
              flex: 'none',
            }}
          >
            <Icon name="mic" />
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 44 }}>
            {WAVE.map((base, i) => {
              const swing = 0.72 + 0.28 * Math.sin(frame * 0.55 + i * 1.9);
              return (
                <i
                  key={i}
                  style={{
                    width: 4,
                    height: Math.max(4, Math.min(44, base * 1.2 * swing * live)),
                    borderRadius: 2,
                    background: color.signal,
                    display: 'block',
                  }}
                />
              );
            })}
          </div>
        </div>
        {/* Three lines are always reserved, so the panel never jumps. */}
        <div style={{ ...text.quote, marginTop: 12, minHeight: 63 }}>
          <Words
            value={step.transcript}
            shown={wordsShown(frame, beat.answerStart, TRANSCRIPT_FRAMES_PER_WORD)}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <Button variant="quiet" icon="keyboard" height={46} fontSize={15} style={{ flex: 1 }}>
          Type instead
        </Button>
        <Button variant="quiet" height={46} fontSize={15} style={{ flex: 1 }}>
          I don't know
        </Button>
      </div>
    </Screen>
  );
};
