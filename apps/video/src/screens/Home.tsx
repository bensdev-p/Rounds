import { color, font, num, radius, size } from '../theme.ts';
import { Chip, Icon, List, Row, Screen, SectionTitle, Segments, Touch, text } from '../ui.tsx';

/* Pimp (home) (mockup: home.png). Opens the session scene: one big action. */
const PATIENTS = [
  { label: 'Diabetic ketoacidosis', logged: 'Logged 8:12 am' },
  { label: 'New-onset atrial fibrillation', logged: 'Logged 10:40 am' },
  { label: 'Community-acquired pneumonia', logged: 'Logged 1:05 pm' },
] as const;

const PERSONAS = ['Teacher', 'Surgeon', 'Internist'] as const;
const CHOSEN = 'Internist';

// Centre of the "Pimp me" button on the 390×844 screen.
const PIMP_ME = { x: 195, y: 412 };

/** `sinceTap` is frames since "Pimp me" is tapped (negative before it). */
export const HomeScreen = ({ sinceTap }: { sinceTap: number }) => (
  <Screen tab="pimp" overlay={<Touch {...PIMP_ME} t={sinceTap} />}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={text.meta}>Thursday, November 13</div>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          height: 32,
          padding: '0 12px 0 10px',
          borderRadius: radius.chip,
          background: color.surface,
          ...font.bodySemi,
          fontSize: 14,
          lineHeight: '18px',
        }}
      >
        <Icon name="ladder" size={16} color={color.signal} />
        Intern
      </span>
    </div>
    <div style={{ ...text.h1, marginTop: 6 }}>Internal medicine</div>
    <div style={{ ...text.meta, marginTop: 6 }}>
      Week 3 of 8 <span style={{ ...text.link, marginLeft: 10 }}>Change rotation</span>
    </div>

    <div
      style={{
        marginTop: 22,
        background: color.surface,
        borderRadius: radius.hero,
        padding: '18px 20px 20px',
        flex: 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={text.h3}>Today's rounds</div>
        <div style={text.small}>
          <span style={{ ...num, fontSize: 16, color: color.text }}>1</span> of 3 sessions
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <Segments filled={1} />
      </div>
      <div style={{ ...text.small, marginTop: 8 }}>12 shifts in a row. Finish rounds to make it 13.</div>
      <div style={{ height: 1, background: color.line, margin: '14px 0' }} />
      <div style={text.h3}>Who's asking?</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          background: color.bg,
          borderRadius: radius.field,
          padding: 4,
          marginTop: 12,
        }}
      >
        {PERSONAS.map((persona) => (
          <span
            key={persona}
            style={{
              textAlign: 'center',
              padding: '9px 0',
              borderRadius: 10,
              ...font.bodyMedium,
              fontSize: 14,
              lineHeight: '15px',
              ...(persona === CHOSEN
                ? { background: color.surface2, color: color.text }
                : { color: color.text2 }),
            }}
          >
            {persona}
          </span>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          height: size.heroButtonHeight - 2,
          marginTop: 16,
          borderRadius: radius.button,
          background: color.signal,
          color: color.onSignal,
          ...font.bodySemi,
          fontSize: 18,
          lineHeight: '22px',
        }}
      >
        <Icon name="mic" size={20} />
        Pimp me
      </div>
    </div>

    <SectionTitle title="From today's patients" right={<span style={text.link}>Log one</span>} />
    <List>
      {PATIENTS.map((patient, i) => (
        <Row key={patient.label} first={i === 0}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...text.h3, ...font.bodyMedium }}>{patient.label}</div>
            <div style={text.small}>{patient.logged}</div>
          </div>
          <Chip>Start</Chip>
        </Row>
      ))}
    </List>
  </Screen>
);
