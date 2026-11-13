import { color, font, num, radius, type } from '../theme.ts';
import { ramp } from '../timeline.ts';
import {
  Badge,
  Bar,
  Button,
  Ladder,
  MiniLadder,
  RUNG_DONE,
  Screen,
  Segments,
  SessionHeader,
  text,
} from '../ui.tsx';

/* Session result, clean run (mockup: win.png). First half of scene 7.
   Today's rounds starts at 2 of 3 (as on result.png) and the third segment
   fills, landing on the win.png state. */
const COUNT_START = 12;
const COUNT_FRAMES = 15; // under 600 ms
const THIRD_SEGMENT = 50;
const RUNGS = 6;

const ALL_DONE = Array.from({ length: RUNGS }, () => RUNG_DONE);

/** `f` is the frame within the scene. */
export const ResultScreen = ({ f }: { f: number }) => {
  const score = Math.round(ramp(f, COUNT_START, COUNT_FRAMES) * RUNGS);
  const roundsDone = f >= THIRD_SEGMENT;

  return (
    <Screen padding="8px 20px 28px">
      <SessionHeader title="Diabetic ketoacidosis" />
      <div style={{ display: 'flex', gap: 22, alignItems: 'flex-end', marginTop: 24 }}>
        <Ladder rungs={ALL_DONE} width={150} />
        <div style={{ paddingBottom: 4 }}>
          <div style={{ ...num, ...type('scoreHero'), color: color.pass }}>{score}</div>
          <div style={{ ...text.meta, marginTop: 6 }}>Top of the ladder</div>
          <div style={{ ...text.small, marginTop: 2 }}>New best (was 5)</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 22, flexWrap: 'wrap' }}>
        <Badge tone="pass" icon="check">
          Clean run
        </Badge>
        <Badge tone="signal" icon="ladder">
          Script mastered
        </Badge>
      </div>
      <div style={{ ...text.quote, marginTop: 14 }}>
        "Fine. Now tell me why the potassium drops when you start the insulin. Tomorrow."
      </div>
      <div
        style={{
          marginTop: 20,
          background: color.surface,
          borderRadius: radius.list,
          padding: '14px 16px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
        }}
      >
        <div>
          <div style={text.small}>Today's rounds</div>
          <div style={{ marginTop: 8 }}>
            <Segments filled={roundsDone ? 3 : 2} />
          </div>
          <div style={{ ...text.small, marginTop: 6, color: color.text }}>
            {roundsDone ? 'Done. 13 shifts in a row' : '2 of 3'}
          </div>
        </div>
        <div>
          <div style={text.small}>Toward Resident</div>
          <div style={{ marginTop: 8 }}>
            <Bar percent={69} height={6} />
          </div>
          <div style={{ ...text.small, marginTop: 6, color: color.text }}>+6 rungs, 378 to go</div>
        </div>
      </div>
      <div
        style={{
          marginTop: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          borderRadius: radius.list,
          background: color.surface,
        }}
      >
        <MiniLadder best={6} />
        <div style={{ fontSize: 14, lineHeight: '20px', flex: 1 }}>
          Internal medicine: <b style={font.bodySemi}>15 of 30</b> mastered
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="quiet" style={{ flex: 1 }}>
          Done
        </Button>
        <Button variant="primary" style={{ flex: 2 }}>
          Next patient
        </Button>
      </div>
    </Screen>
  );
};
