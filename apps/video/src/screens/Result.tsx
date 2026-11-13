import type { ReactNode } from 'react';
import { color, font, num, radius, type } from '../theme.ts';
import { ramp } from '../timeline.ts';
import {
  Badge,
  Bar,
  Button,
  Icon,
  Ladder,
  List,
  MiniLadder,
  RUNG_DIM,
  RUNG_DONE,
  RUNG_MISS,
  Row,
  Screen,
  Segments,
  SessionHeader,
  text,
} from '../ui.tsx';

/* Session result. Two states of the same screen:
   - with a miss (mockup: result.png), straight after the climb;
   - clean run (mockup: win.png), which leads into the promotion. */

const COUNT_START = 12;
const COUNT_FRAMES = 15; // the score counts up once, under 600 ms

const countUp = (f: number, to: number): number =>
  Math.round(ramp(f, COUNT_START, COUNT_FRAMES) * to);

const Score = ({
  ladder,
  score,
  scoreColor,
  line1,
  line2,
}: {
  ladder: ReactNode;
  score: number;
  scoreColor: string;
  line1: string;
  line2: string;
}) => (
  <div style={{ display: 'flex', gap: 22, alignItems: 'flex-end', marginTop: 24 }}>
    {ladder}
    <div style={{ paddingBottom: 4 }}>
      <div style={{ ...num, ...type('scoreHero'), color: scoreColor }}>{score}</div>
      <div style={{ ...text.meta, marginTop: 6 }}>{line1}</div>
      <div style={{ ...text.small, marginTop: 2 }}>{line2}</div>
    </div>
  </div>
);

const Progress = ({
  rounds,
  roundsLine,
  rankPercent,
  rankLine,
  margin,
}: {
  rounds: number;
  roundsLine: string;
  rankPercent: number;
  rankLine: string;
  margin: string;
}) => (
  <div
    style={{
      margin,
      background: color.surface,
      borderRadius: radius.list,
      padding: '14px 16px',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 16,
      flex: 'none',
    }}
  >
    <div>
      <div style={text.small}>Today's rounds</div>
      <div style={{ marginTop: 8 }}>
        <Segments filled={rounds} />
      </div>
      <div style={{ ...text.small, marginTop: 6, color: color.text }}>{roundsLine}</div>
    </div>
    <div>
      <div style={text.small}>Toward Resident</div>
      <div style={{ marginTop: 8 }}>
        <Bar percent={rankPercent} height={6} />
      </div>
      <div style={{ ...text.small, marginTop: 6, color: color.text }}>{rankLine}</div>
    </div>
  </div>
);

const Actions = ({ primary }: { primary: string }) => (
  <div style={{ display: 'flex', gap: 10 }}>
    <Button variant="quiet" style={{ flex: 1 }}>
      Done
    </Button>
    <Button variant="primary" style={{ flex: 2 }}>
      {primary}
    </Button>
  </div>
);

const MISS_LADDER = [RUNG_DONE, RUNG_DONE, RUNG_DONE, RUNG_DONE, RUNG_MISS, RUNG_DIM];
const CLEAN_LADDER = Array.from({ length: 6 }, () => RUNG_DONE);

/** Result with a miss. `f` is the frame within the scene. */
export const MissResultScreen = ({ f }: { f: number }) => (
  <Screen padding="8px 20px 28px">
    <SessionHeader title="Acute pancreatitis" />
    <Score
      ladder={<Ladder rungs={MISS_LADDER} width={150} />}
      score={countUp(f, 4)}
      scoreColor={color.text}
      line1="rungs climbed"
      line2="Your best here is 5"
    />
    <div
      style={{
        marginTop: 24,
        background: color.surface,
        borderRadius: radius.list,
        padding: 16,
        flex: 'none',
      }}
    >
      <div style={text.small}>Missed on management</div>
      <div style={{ marginTop: 6, fontSize: 15, lineHeight: '21px' }}>
        You said <span style={{ color: color.miss }}>"keep them NPO until the pain resolves."</span>{' '}
        Early oral feeding, as tolerated, is preferred in mild disease.
      </div>
      <div style={{ ...text.link, marginTop: 10 }}>Review the script</div>
    </div>
    <List style={{ marginTop: 12, flex: 'none' }}>
      <Row first>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={text.rowTitle}>Unsuspend 3 Anki cards</div>
          <div style={text.small}>Syncs next time Anki opens</div>
        </div>
        <Icon name="chevron" size={18} color={color.text3} />
      </Row>
    </List>
    <Progress
      rounds={2}
      roundsLine="2 of 3"
      rankPercent={99}
      rankLine="+4 rungs, 6 to go"
      margin="12px 0 14px"
    />
    <div style={{ flex: 1 }} />
    <Actions primary="Go again" />
  </Screen>
);

const THIRD_SEGMENT = 50;

/** Clean run, the session that earns the promotion. `f` is the frame within the scene. */
export const CleanResultScreen = ({ f }: { f: number }) => {
  // Rounds segments fill instantly; this session finishes today's rounds and
  // carries the student past the 1,200 rungs needed for Resident.
  const landed = f >= THIRD_SEGMENT;

  return (
    <Screen padding="8px 20px 28px">
      <SessionHeader title="Diabetic ketoacidosis" />
      <Score
        ladder={<Ladder rungs={CLEAN_LADDER} width={150} />}
        score={countUp(f, 6)}
        scoreColor={color.pass}
        line1="Top of the ladder"
        line2="New best (was 5)"
      />
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
      <Progress
        rounds={landed ? 3 : 2}
        roundsLine={landed ? 'Done. 13 shifts in a row' : '2 of 3'}
        rankPercent={landed ? 100 : 99}
        rankLine={landed ? '+6 rungs. Resident' : '6 rungs to go'}
        margin="20px 0 0"
      />
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
      <Actions primary="Next patient" />
    </Screen>
  );
};
