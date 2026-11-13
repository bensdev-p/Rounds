import type { ReactNode } from 'react';
import { interpolateColors } from 'remotion';
import { color, radius, size } from '../theme.ts';
import { clamp01, ramp } from '../timeline.ts';
import { Chip, Icon, List, Mark, Row, Screen, SectionTitle, text } from '../ui.tsx';

/* Log, with the privacy guard (mockup: log.png). Scene 5.
   "Mr. Alvarez CHF" is typed, the guard fires, the name is deleted, and the
   entry is saved as a diagnosis label only. */
const NAME = 'Mr. Alvarez ';
const QUERY = 'CHF';
const TYPED = NAME + QUERY;

const TYPE_START = 12;
const FRAMES_PER_CHAR = 3;
const NAME_TYPED = TYPE_START + NAME.length * FRAMES_PER_CHAR; // the guard fires
const QUERY_TYPED = TYPE_START + TYPED.length * FRAMES_PER_CHAR; // matches appear
const DELETE_START = 120;
const FRAMES_PER_DELETE = 2;
const NAME_DELETED = DELETE_START + NAME.length * FRAMES_PER_DELETE; // the guard clears
const SAVED = 168;

const COLLAPSE = 8;

/** Collapses to nothing: used for the warning and the matching scripts. */
const Reveal = ({ amount, maxHeight, children }: { amount: number; maxHeight: number; children: ReactNode }) =>
  amount <= 0 ? null : (
    <div style={{ maxHeight: maxHeight * amount, opacity: amount, overflow: 'hidden', flex: 'none' }}>
      {children}
    </div>
  );

const Caret = () => (
  <span
    style={{
      display: 'inline-block',
      width: 2,
      height: 20,
      background: color.signal,
      verticalAlign: 'middle',
      marginLeft: 1,
    }}
  />
);

const LOGGED = [
  { label: 'Diabetic ketoacidosis', tone: 'pass', status: 'Pimped, rung 5' },
  { label: 'New-onset atrial fibrillation', tone: 'signal', status: 'Not yet' },
  { label: 'Community-acquired pneumonia', tone: 'signal', status: 'Not yet' },
] as const;

/** `f` is the frame within the scene. */
export const LogScreen = ({ f }: { f: number }) => {
  const typedCount = Math.min(TYPED.length, Math.max(0, Math.floor((f - TYPE_START) / FRAMES_PER_CHAR)));
  const deleted = Math.min(NAME.length, Math.max(0, Math.floor((f - DELETE_START) / FRAMES_PER_DELETE)));
  const saved = f >= SAVED;

  // The caret sits at the end while typing, then after the name while deleting.
  const beforeCaret = saved ? '' : f < DELETE_START ? TYPED.slice(0, typedCount) : NAME.slice(0, NAME.length - deleted);
  const afterCaret = saved || f < DELETE_START ? '' : QUERY;

  const guard = clamp01(ramp(f, NAME_TYPED, COLLAPSE) - ramp(f, NAME_DELETED, COLLAPSE));
  const matches = clamp01(ramp(f, QUERY_TYPED, COLLAPSE) - ramp(f, SAVED, COLLAPSE));
  const canSave = f >= NAME_DELETED;
  const newRow = ramp(f, SAVED, COLLAPSE);

  return (
    <Screen tab="log">
      <div style={text.h1}>Log a patient</div>
      <div style={{ ...text.meta, marginTop: 6 }}>Diagnosis only. No names, dates or record numbers.</div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          height: size.fieldHeight,
          padding: '0 16px',
          marginTop: 22,
          borderRadius: radius.field,
          background: color.surface,
          border: `1.5px solid ${interpolateColors(guard, [0, 1], [color.line, color.miss])}`,
          flex: 'none',
        }}
      >
        <Icon name="search" size={20} color={color.text3} />
        <span style={{ whiteSpace: 'pre' }}>
          {beforeCaret}
          <Caret />
          {afterCaret}
        </span>
      </div>

      <Reveal amount={guard} maxHeight={76}>
        <div
          style={{
            display: 'flex',
            gap: 10,
            padding: '12px 14px',
            marginTop: 10,
            borderRadius: radius.row,
            background: color.missSoft,
            fontSize: 14,
            lineHeight: '20px',
          }}
        >
          <Icon name="warning" size={18} color={color.miss} style={{ marginTop: 1 }} />
          <span>This looks like a patient's name. Remove "Mr. Alvarez" and keep only the diagnosis.</span>
        </div>
      </Reveal>

      <Reveal amount={matches} maxHeight={190}>
        <div style={{ ...text.small, marginTop: 20 }}>Matching scripts</div>
        <List style={{ marginTop: 8 }}>
          {['Heart failure exacerbation', 'Heart failure with reduced EF'].map((label, i) => (
            <Row key={label} first={i === 0}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={text.rowTitle}>{label}</div>
                <div style={text.small}>Internal medicine, cardiology</div>
              </div>
              <Chip style={{ opacity: canSave ? 1 : 0.45 }}>Save</Chip>
            </Row>
          ))}
        </List>
      </Reveal>

      <SectionTitle
        title="Logged today"
        right={<span style={text.small}>{saved ? 4 : 3} patients</span>}
      />
      <List>
        <Reveal amount={newRow} maxHeight={52}>
          <Row first>
            <Mark tone="signal" />
            <div style={{ flex: 1, minWidth: 0, ...text.rowTitle }}>Heart failure exacerbation</div>
            <span style={text.small}>Not yet</span>
          </Row>
        </Reveal>
        {LOGGED.map((entry, i) => (
          <Row key={entry.label} first={i === 0 && !saved}>
            <Mark tone={entry.tone} />
            <div style={{ flex: 1, minWidth: 0, ...text.rowTitle }}>{entry.label}</div>
            <span style={text.small}>{entry.status}</span>
          </Row>
        ))}
      </List>
    </Screen>
  );
};
