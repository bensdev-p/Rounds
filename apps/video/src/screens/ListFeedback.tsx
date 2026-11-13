import { color, font, num, radius } from '../theme.ts';
import { easeOut, ramp } from '../timeline.ts';
import { Button, Icon, Screen, SessionHeader, text } from '../ui.tsx';

/* List-question feedback (mockup: list.png). Scene 4. */
const ANSWERS = [
  { label: 'Lactic acidosis', got: true },
  { label: 'Diabetic ketoacidosis', got: true },
  { label: 'Methanol', got: true },
  { label: 'Uremia', got: false },
  { label: 'Salicylates', got: false },
] as const;

const FIRST_PILL = 30;
const PILL_GAP = 6;
const PILL_SLIDE = 8;

/** `f` is the frame within the scene. */
export const ListFeedbackScreen = ({ f }: { f: number }) => {
  const arrived = (i: number): number => FIRST_PILL + i * PILL_GAP;
  // The score counts 0 → 3 as each correct answer lands.
  const score = ANSWERS.filter((a, i) => a.got && f >= arrived(i)).length;
  const lastPill = arrived(ANSWERS.length - 1) + PILL_SLIDE;

  return (
    <Screen padding="8px 20px 28px">
      <SessionHeader
        title="Teacher"
        right={<span style={{ ...num, fontSize: 18, color: color.text2 }}>1:18</span>}
      />
      <div style={{ ...text.meta, marginTop: 26 }}>Anion gap metabolic acidosis, rung 2</div>
      <div style={{ ...text.question, marginTop: 8 }}>Name five causes.</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 22 }}>
        <span style={{ ...num, fontSize: 56, lineHeight: 1, color: color.signal }}>{score}</span>
        <span style={{ ...num, fontSize: 28, lineHeight: 1, color: color.text3 }}>/ 5</span>
        <span style={{ ...text.meta, marginLeft: 8, opacity: ramp(f, lastPill + 4) }}>
          Partial credit. You climb.
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
        {ANSWERS.map((answer, i) => {
          const p = easeOut(ramp(f, arrived(i), PILL_SLIDE));
          return (
            <div
              key={answer.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                borderRadius: radius.row,
                ...font.bodyMedium,
                fontSize: 15,
                lineHeight: '18px',
                opacity: p,
                transform: `translateY(${(1 - p) * 14}px)`,
                ...(answer.got
                  ? { background: color.passSoft }
                  : { border: `1.5px dashed ${color.miss}` }),
              }}
            >
              <Icon
                name={answer.got ? 'check' : 'minusCircle'}
                size={18}
                color={answer.got ? color.pass : color.miss}
              />
              {answer.label}
            </div>
          );
        })}
      </div>
      <div style={{ ...text.quote, marginTop: 18, opacity: ramp(f, lastPill + 14) }}>
        "Good start. Uremia and salicylates come up on every service, so remember those two."
      </div>
      <div style={{ flex: 1 }} />
      <Button variant="primary">Next question</Button>
    </Screen>
  );
};
