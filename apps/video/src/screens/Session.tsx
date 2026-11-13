import { color, num, radius } from '../theme.ts';
import { FPS, FRAMES_PER_WORD, RUNG_PASSES, ramp, rungPass, scene, wordsShown } from '../timeline.ts';
import {
  Button,
  Icon,
  Ladder,
  RUNG_DIM,
  type RungVisual,
  Screen,
  SessionHeader,
  Words,
  text,
} from '../ui.tsx';

/* Live session (mockup: session.png). Scenes 2 and 3 share this screen.
   Every answer traces to the "Who gets it" field of the acute pancreatitis
   script in script.png; the rung 3 question and transcript are the mockup's. */
const STEPS = [
  {
    question: 'What are the two most common causes of acute pancreatitis?',
    transcript: '"Gallstones first, then heavy alcohol use."',
    questionDelay: 20,
    answerDelay: 30,
  },
  {
    question: 'And the next most common cause after those?',
    transcript: '"Hypertriglyceridemia. It can also follow an ERCP."',
    questionDelay: 6,
    answerDelay: 8,
  },
  {
    question: 'How would you tell gallstone pancreatitis from alcoholic pancreatitis at the bedside?',
    transcript:
      '"I\'d check the ALT. If it\'s more than three times normal, that points to gallstones, and then right upper quadrant…',
    questionDelay: 6,
    answerDelay: 6,
  },
] as const;

const TRANSCRIPT_FRAMES_PER_WORD = 3.5;
const WAVE = [10, 18, 30, 22, 40, 28, 14, 34, 24, 12, 20, 8, 16, 26, 12];
const TIMER_START_SECONDS = 25;

const [PASS_1, PASS_2] = RUNG_PASSES;
const SESSION_START = scene('session').from;

/** The amber pop for the rung that becomes current at `at`. */
const popped = (frame: number, at: number): Pick<RungVisual, 'now' | 'scale'> => {
  if (frame < at) return { now: 0, scale: 1 };
  const { pop, fill } = rungPass(frame, at);
  return { now: fill, scale: 0.7 + 0.3 * pop };
};

const ladderAt = (frame: number): RungVisual[] => [
  { now: 1, scale: 1, done: rungPass(frame, PASS_1).fill, label: frame < PASS_1 ? 'now' : 'done' },
  {
    ...popped(frame, PASS_1),
    done: rungPass(frame, PASS_2).fill,
    label: frame < PASS_1 ? 'dim' : frame < PASS_2 ? 'now' : 'done',
  },
  { ...popped(frame, PASS_2), done: 0, label: frame < PASS_2 ? 'dim' : 'now' },
  RUNG_DIM,
  RUNG_DIM,
  RUNG_DIM,
];

const clock = (frame: number): string => {
  const seconds = TIMER_START_SECONDS + Math.floor(Math.max(0, frame - SESSION_START) / FPS);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** `frame` is the global frame. */
export const SessionScreen = ({ frame }: { frame: number }) => {
  const stepIndex = frame < PASS_1 ? 0 : frame < PASS_2 ? 1 : 2;
  const step = STEPS[stepIndex];
  const stepStart = [SESSION_START, PASS_1, PASS_2][stepIndex] ?? SESSION_START;

  const questionStart = stepStart + step.questionDelay;
  const questionEnd = questionStart + step.question.split(' ').length * FRAMES_PER_WORD;
  const answerStart = questionEnd + step.answerDelay;
  // The mic goes live once the attending has finished asking.
  const live = ramp(frame, questionEnd, 6);

  return (
    <Screen padding="8px 20px 28px">
      <SessionHeader
        title="Internist"
        right={<span style={{ ...num, fontSize: 18, color: color.text2 }}>{clock(frame)}</span>}
      />
      <div style={{ marginTop: 26 }}>
        <Ladder rungs={ladderAt(frame)} width={190} />
      </div>
      <div style={{ marginTop: 30 }}>
        <div style={text.meta}>Acute pancreatitis</div>
        <div style={{ ...text.question, marginTop: 8 }}>
          <Words value={step.question} shown={wordsShown(frame, questionStart)} />
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
            shown={wordsShown(frame, answerStart, TRANSCRIPT_FRAMES_PER_WORD)}
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
