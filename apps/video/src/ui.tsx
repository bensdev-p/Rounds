import type { CSSProperties, ReactNode } from 'react';
import { color, font, num, radius, size, type } from './theme.ts';

/* Recreated from docs/design/mockups (rounds.css + index.html). All sizes are
   logical points on the 390×844 screen; the phone frame scales them up. */

export const PHONE_W = 390;
export const PHONE_H = 844;
const PHONE_RADIUS = 44;

// ---------------------------------------------------------------- icons

const iconPaths = {
  ladder: <path d="M7 3v18M17 3v18M7 7.5h10M7 12h10M7 16.5h10" />,
  log: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2.5" />
      <path d="M9.5 3v3h5V3M12 10.5v6M9 13.5h6" />
    </>
  ),
  book: (
    <>
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5z" />
      <path d="M5 20.5A2.5 2.5 0 0 1 7.5 18H19v3H7.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
  mic: (
    <>
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  keyboard: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <path d="M7 10h.01M11 10h.01M15 10h.01M7.5 14h9" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  minusCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8" />
    </>
  ),
  chevron: <path d="M9 6l6 6-6 6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3.5l9.5 17h-19z" />
      <path d="M12 10v4.5M12 17.5v.3" />
    </>
  ),
  sync: (
    <>
      <path d="M4.5 12A7.5 7.5 0 0 1 18 7.5M19.5 12A7.5 7.5 0 0 1 6 16.5" />
      <path d="M18 3.5v4h-4M6 20.5v-4h4" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof iconPaths;

export const Icon = ({
  name,
  size: s = 24,
  color: stroke = 'currentColor',
  style = {},
}: {
  name: IconName;
  size?: number;
  color?: string;
  style?: CSSProperties;
}) => (
  <svg
    width={s}
    height={s}
    viewBox="0 0 24 24"
    fill="none"
    stroke={stroke}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flex: 'none', display: 'block', ...style }}
  >
    {iconPaths[name]}
  </svg>
);

// ----------------------------------------------------------------- type

export const text = {
  h1: { ...type('h1'), letterSpacing: '-0.01em' },
  h2: type('h2'),
  h3: type('h3'),
  question: { ...type('question'), letterSpacing: '-0.01em' },
  body: type('body'),
  /** 15 pt supporting copy used for quotes and transcripts in the mockups. */
  quote: { ...font.body, fontSize: 15, lineHeight: '21px', color: color.text2 },
  meta: { ...type('meta'), color: color.text2 },
  small: { ...type('small'), color: color.text2 },
  link: { ...font.bodyMedium, fontSize: 14, lineHeight: '20px', color: color.ceil },
  rowTitle: { ...font.bodyMedium, fontSize: 16, lineHeight: '22px' },
} satisfies Record<string, CSSProperties>;

// ---------------------------------------------------------------- frame

export const Phone = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      width: PHONE_W,
      height: PHONE_H,
      borderRadius: PHONE_RADIUS,
      overflow: 'hidden',
      position: 'relative',
      background: color.bg,
      color: color.text,
      // A hairline so the 44 pt corners read against the same-colour backdrop.
      boxShadow: `0 0 0 1.5px ${color.line}`,
      ...text.body,
    }}
  >
    {children}
  </div>
);

const StatusBar = () => (
  <div
    style={{
      height: 50,
      flex: 'none',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      padding: '0 30px 8px',
      ...font.bodySemi,
      fontSize: 15,
      lineHeight: '18px',
    }}
  >
    <span>9:41</span>
    <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <i
        style={{
          width: 15,
          height: 9,
          background: color.text,
          display: 'block',
          clipPath:
            'polygon(0 100%, 25% 100%, 25% 70%, 50% 70%, 50% 40%, 75% 40%, 75% 0, 100% 0, 100% 100%)',
        }}
      />
      <i style={{ width: 17, height: 10, borderRadius: 2, background: color.text, display: 'block' }} />
    </span>
  </div>
);

const TABS: readonly { id: TabId; label: string; icon: IconName }[] = [
  { id: 'pimp', label: 'Pimp', icon: 'ladder' },
  { id: 'log', label: 'Log', icon: 'log' },
  { id: 'review', label: 'Review', icon: 'book' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];
export type TabId = 'pimp' | 'log' | 'review' | 'profile';

const TabBar = ({ active }: { active: TabId }) => (
  <div
    style={{
      flex: 'none',
      height: size.tabBar,
      borderTop: `1px solid ${color.line}`,
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      padding: '8px 8px 26px',
      background: color.bg,
    }}
  >
    {TABS.map((tab) => {
      const on = tab.id === active;
      return (
        <div
          key={tab.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            ...font.bodyMedium,
            fontSize: 11,
            lineHeight: '15px',
            color: on ? color.text : color.text3,
          }}
        >
          <Icon name={tab.icon} color={on ? color.signal : color.text3} />
          <span>{tab.label}</span>
        </div>
      );
    })}
  </div>
);

/** One full screen: status bar, padded content, optional tab bar. */
export const Screen = ({
  children,
  tab = null,
  padding = '8px 20px 0',
  overlay = null,
}: {
  children: ReactNode;
  tab?: TabId | null;
  padding?: string;
  /** Drawn above the screen in screen coordinates (touch cues). */
  overlay?: ReactNode;
}) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      background: color.bg,
    }}
  >
    <StatusBar />
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        padding,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </div>
    {tab ? <TabBar active={tab} /> : null}
    {overlay}
  </div>
);

/** A fingertip: appears where the student taps, then fades. `t` is frames since the tap. */
export const Touch = ({ x, y, t }: { x: number; y: number; t: number }) => {
  if (t < -4 || t > 10) return null;
  const opacity = t < 0 ? (t + 4) / 4 : 1 - t / 10;
  const scale = t < 0 ? 1.15 - 0.15 * ((t + 4) / 4) : 1 + 0.25 * (t / 10);
  return (
    <span
      style={{
        position: 'absolute',
        left: x - 22,
        top: y - 22,
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: color.text,
        opacity: 0.28 * opacity,
        transform: `scale(${scale})`,
      }}
    />
  );
};

// ------------------------------------------------------------- controls

export const CloseButton = () => (
  <span
    style={{
      width: 36,
      height: 36,
      borderRadius: '50%',
      background: color.surface,
      display: 'grid',
      placeItems: 'center',
      flex: 'none',
    }}
  >
    <Icon name="close" size={18} />
  </span>
);

/** Session-style header: close button, centred title, optional right slot. */
export const SessionHeader = ({ title, right = null }: { title: string; right?: ReactNode }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 'none' }}>
    <CloseButton />
    <span style={text.meta}>{title}</span>
    {right ?? <span style={{ width: 36 }} />}
  </div>
);

export const Button = ({
  variant,
  children,
  icon = null,
  height = size.buttonHeight,
  fontSize = 16,
  style = {},
}: {
  variant: 'primary' | 'quiet';
  children: ReactNode;
  icon?: IconName | null;
  height?: number;
  fontSize?: number;
  style?: CSSProperties;
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      height,
      borderRadius: radius.button,
      ...font.bodySemi,
      fontSize,
      lineHeight: `${fontSize + 4}px`,
      background: variant === 'primary' ? color.signal : color.surface2,
      color: variant === 'primary' ? color.onSignal : color.text,
      flex: 'none',
      ...style,
    }}
  >
    {icon ? <Icon name={icon} size={20} /> : null}
    {children}
  </div>
);

export const Chip = ({ children, style = {} }: { children: ReactNode; style?: CSSProperties }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 30,
      padding: '0 12px',
      borderRadius: radius.chip,
      ...font.bodyMedium,
      fontSize: 13,
      lineHeight: '18px',
      background: color.surface2,
      color: color.text,
      whiteSpace: 'nowrap',
      flex: 'none',
      ...style,
    }}
  >
    {children}
  </span>
);

export const List = ({ children, style = {} }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ background: color.surface, borderRadius: radius.list, overflow: 'hidden', ...style }}>
    {children}
  </div>
);

export const Row = ({ children, first = false }: { children: ReactNode; first?: boolean }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '14px 16px',
      borderTop: first ? 'none' : `1px solid ${color.line}`,
    }}
  >
    {children}
  </div>
);

export const Mark = ({ tone }: { tone: 'pass' | 'signal' | 'miss' }) => (
  <span style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: color[tone] }} />
);

export const SectionTitle = ({
  title,
  right = null,
  marginTop = 26,
}: {
  title: string;
  right?: ReactNode;
  marginTop?: number;
}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      margin: `${marginTop}px 0 10px`,
    }}
  >
    <span style={text.h3}>{title}</span>
    {right}
  </div>
);

// ----------------------------------------------------------- the ladder

export const LADDER_LABELS = [
  'Recall',
  'Next most common',
  'Tell it apart',
  'Workup',
  'Management',
  'Pearl',
] as const;

export interface RungVisual {
  /** 0–1: how much of the amber "current" state shows. */
  now: number;
  /** 0–1: how far the green "passed" state has filled, bottom to top. */
  done: number;
  /** 0–1: how much of the coral "missed" state shows. */
  miss: number;
  /** Scale of the square, for the amber pop. */
  scale: number;
  label: 'dim' | 'now' | 'done' | 'miss';
}

export const RUNG_DIM: RungVisual = { now: 0, done: 0, miss: 0, scale: 1, label: 'dim' };
export const RUNG_NOW: RungVisual = { now: 1, done: 0, miss: 0, scale: 1, label: 'now' };
export const RUNG_DONE: RungVisual = { now: 0, done: 1, miss: 0, scale: 1, label: 'done' };
export const RUNG_MISS: RungVisual = { now: 0, done: 0, miss: 1, scale: 1, label: 'miss' };

const rungFace: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  ...type('rungNumber'),
};

const labelStyle: Record<RungVisual['label'], CSSProperties> = {
  dim: { ...font.bodyMedium, color: color.text3 },
  done: { ...font.bodyMedium, color: color.text2 },
  now: { ...font.bodySemi, color: color.text },
  miss: { ...font.bodySemi, color: color.miss },
};

const Rung = ({ n, label, visual }: { n: number; label: string; visual: RungVisual }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: size.rung }}>
    <div
      style={{
        width: size.rung,
        height: size.rung,
        borderRadius: radius.rung,
        flex: 'none',
        position: 'relative',
        overflow: 'hidden',
        background: color.surface,
        transform: `scale(${visual.scale})`,
      }}
    >
      <span style={{ ...rungFace, color: color.text3 }}>{n}</span>
      {visual.now > 0 ? (
        <span
          style={{ ...rungFace, background: color.signal, color: color.onSignal, opacity: visual.now }}
        >
          {n}
        </span>
      ) : null}
      {visual.done > 0 ? (
        <span
          style={{
            ...rungFace,
            background: color.bg,
            clipPath: `inset(${(1 - visual.done) * 100}% 0 0 0)`,
          }}
        >
          <span style={{ ...rungFace, background: color.passSoft, color: color.pass }}>{n}</span>
        </span>
      ) : null}
      {visual.miss > 0 ? (
        <span style={{ ...rungFace, background: color.bg, opacity: visual.miss }}>
          <span style={{ ...rungFace, background: color.missSoft, color: color.miss }}>{n}</span>
        </span>
      ) : null}
    </div>
    <span style={{ fontSize: 13, lineHeight: '14px', ...labelStyle[visual.label] }}>{label}</span>
  </div>
);

/** Six rungs, bottom to top. `rungs[0]` is rung 1. */
export const Ladder = ({ rungs, width }: { rungs: readonly RungVisual[]; width: number }) => (
  <div style={{ width, flex: 'none', display: 'flex', flexDirection: 'column-reverse', gap: 6 }}>
    {LADDER_LABELS.map((label, i) => (
      <Rung key={label} n={i + 1} label={label} visual={rungs[i] ?? RUNG_DIM} />
    ))}
  </div>
);

// ---------------------------------------------------------- progression

/** Today's rounds: three 6 pt segments with 6 pt gaps. */
export const Segments = ({ filled }: { filled: number }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
    {[0, 1, 2].map((i) => (
      <i
        key={i}
        style={{
          height: 6,
          borderRadius: 3,
          display: 'block',
          background: i < filled ? color.signal : color.surface2,
        }}
      />
    ))}
  </div>
);

export const Bar = ({ percent, height = 8 }: { percent: number; height?: number }) => (
  <div style={{ height, borderRadius: 4, background: color.surface2, overflow: 'hidden' }}>
    <i
      style={{
        display: 'block',
        height: '100%',
        width: `${percent}%`,
        borderRadius: 4,
        background: color.signal,
      }}
    />
  </div>
);

export const Badge = ({
  tone,
  icon,
  children,
}: {
  tone: 'pass' | 'signal';
  icon: IconName;
  children: ReactNode;
}) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 28,
      padding: '0 11px',
      borderRadius: 8,
      ...font.bodySemi,
      fontSize: 13,
      lineHeight: '18px',
      background: tone === 'pass' ? color.passSoft : color.signalSoft,
      color: color[tone],
    }}
  >
    <Icon name={icon} size={15} />
    {children}
  </span>
);

/** Mini ladder: 6 stacked 3 pt bars, 22 pt wide. */
export const MiniLadder = ({ best }: { best: number }) => (
  <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 2, width: 22, flex: 'none' }}>
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <i
        key={i}
        style={{
          height: 3,
          borderRadius: 1.5,
          display: 'block',
          background: i < best ? color.pass : color.surface2,
        }}
      />
    ))}
  </div>
);

/** Words that appear one by one without the lines re-wrapping. */
export const Words = ({ value, shown }: { value: string; shown: number }) => (
  <>
    {value.split(' ').map((word, i) => (
      <span key={i} style={{ opacity: i < shown ? 1 : 0 }}>
        {word}{' '}
      </span>
    ))}
  </>
);

export { num };
