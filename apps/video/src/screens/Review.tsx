import type { CSSProperties } from 'react';
import { color, font, radius } from '../theme.ts';
import { easeOut, ramp } from '../timeline.ts';
import { Button, Icon, List, Mark, Row, Screen, SectionTitle, text } from '../ui.tsx';

/* Evening review (mockup: review.png). Scene 6. */
const MISSED = [
  { title: 'Acute pancreatitis', detail: 'Management: early feeding vs. NPO' },
  { title: 'Anion gap acidosis', detail: 'Missed uremia, salicylates' },
] as const;

const PAIR = [
  {
    name: 'Nephritic',
    rows: [
      ['Urine', 'Hematuria, RBC casts'],
      ['Protein', 'Under 3.5 g/day'],
      ['Classic', 'Post-strep GN'],
    ],
  },
  {
    name: 'Nephrotic',
    rows: [
      ['Urine', 'Fatty casts'],
      ['Protein', 'Over 3.5 g/day'],
      ['Classic', 'Minimal change'],
    ],
  },
] as const;

const SLIDE_START = 30;
const SLIDE_PX = 40;

const keyStyle: CSSProperties = { fontSize: 12, lineHeight: '17px', color: color.text3, marginTop: 10 };
const valueStyle: CSSProperties = { ...font.bodyMedium, fontSize: 14, lineHeight: '19px' };

/** `f` is the frame within the scene. */
export const ReviewScreen = ({ f }: { f: number }) => {
  // The two columns slide together from the left and right, 40 px, and fade in.
  const p = easeOut(ramp(f, SLIDE_START));

  return (
    <Screen tab="review">
      <div style={text.h1}>Tonight's review</div>
      <div style={{ ...text.meta, marginTop: 6 }}>About 12 minutes</div>

      <SectionTitle title="Missed today" marginTop={22} />
      <List>
        {MISSED.map((miss, i) => (
          <Row key={miss.title} first={i === 0}>
            <Mark tone="miss" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={text.rowTitle}>{miss.title}</div>
              <div style={text.small}>{miss.detail}</div>
            </div>
            <Icon name="chevron" size={18} color={color.text3} />
          </Row>
        ))}
      </List>

      <SectionTitle
        title="You keep mixing these up"
        right={<span style={text.small}>3 times this week</span>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 'none' }}>
        {PAIR.map((side, i) => {
          const left = i === 0;
          return (
            <div
              key={side.name}
              style={{
                padding: '14px 16px',
                background: color.surface,
                borderRadius: left ? `${radius.list}px 0 0 ${radius.list}px` : `0 ${radius.list}px ${radius.list}px 0`,
                borderLeft: left ? 'none' : `1px solid ${color.line}`,
                opacity: p,
                transform: `translateX(${(left ? -1 : 1) * (1 - p) * SLIDE_PX}px)`,
              }}
            >
              <div style={{ ...text.h2, fontSize: 19, lineHeight: '22px' }}>{side.name}</div>
              {side.rows.map(([key, value]) => (
                <div key={key}>
                  <div style={keyStyle}>{key}</div>
                  <div style={valueStyle}>{value}</div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <Button variant="quiet" height={46} fontSize={15} style={{ marginTop: 12 }}>
        Drill this pair
      </Button>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginTop: 18,
          padding: '14px 16px',
          borderRadius: radius.list,
          background: color.ceilSoft,
          flex: 'none',
        }}
      >
        <Icon name="sync" size={20} color={color.ceil} />
        <div style={{ fontSize: 14, lineHeight: '20px' }}>
          7 Anki cards unsuspended today. They'll show up next time you open Anki.
        </div>
      </div>
    </Screen>
  );
};
