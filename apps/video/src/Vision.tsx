import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { HomeScreen } from './screens/Home.tsx';
import { ListFeedbackScreen } from './screens/ListFeedback.tsx';
import { LogScreen } from './screens/Log.tsx';
import { PromotionScreen } from './screens/Promotion.tsx';
import { CleanResultScreen, MissResultScreen } from './screens/Result.tsx';
import { ReviewScreen } from './screens/Review.tsx';
import { SessionScreen } from './screens/Session.tsx';
import { color, font, radius } from './theme.ts';
import {
  END_CARD_LINE,
  FADE,
  HOME_TAP,
  PROMOTION_CUT,
  SESSION_START,
  TAGLINE,
  cameraZoom,
  easeOut,
  ramp,
  scene,
  sceneAt,
  wordsShown,
} from './timeline.ts';
import { PHONE_H, PHONE_W, Phone, Words } from './ui.tsx';

export type Layout = 'vertical' | 'wide';

interface LayoutSpec {
  /** Height of the phone as a share of the frame height. */
  phoneHeight: number;
  /** Where the phone's centre sits, as a share of the frame width. */
  phoneCenterX: number;
  /** Gap below the phone, in px. The rest of the spare height goes above it. */
  phoneBottom: number;
  caption: CSSProperties;
  wordmarkSize: number;
  lineSize: number;
  /** The cold open's question. */
  hookSize: number;
  hookWidth: number;
}

const LAYOUTS: Record<Layout, LayoutSpec> = {
  // Phone fills the frame; captions above it.
  vertical: {
    phoneHeight: 0.835,
    phoneCenterX: 0.5,
    phoneBottom: 46,
    caption: {
      left: 60,
      right: 60,
      top: 40,
      height: 220,
      fontSize: 60,
      lineHeight: '70px',
      textAlign: 'center',
    },
    wordmarkSize: 230,
    lineSize: 46,
    hookSize: 124,
    hookWidth: 880,
  },
  // Phone on the right; captions large on the left.
  wide: {
    phoneHeight: 0.92,
    phoneCenterX: 0.75,
    phoneBottom: 43,
    caption: {
      left: 150,
      width: 900,
      top: 0,
      bottom: 0,
      fontSize: 96,
      lineHeight: '104px',
      textAlign: 'left',
    },
    wordmarkSize: 230,
    lineSize: 46,
    hookSize: 136,
    hookWidth: 1300,
  },
};

const intro = scene('intro');
const session = scene('session');
const result = scene('result');
const list = scene('list');
const log = scene('log');
const review = scene('review');
const promotion = scene('promotion');
const end = scene('end');

const Wordmark = ({ fontSize }: { fontSize: number }) => (
  <div style={{ ...font.display, fontSize, lineHeight: 1, letterSpacing: '-0.01em', color: color.text }}>
    Rounds
  </div>
);

const Line = ({ children, fontSize }: { children: ReactNode; fontSize: number }) => (
  <div
    style={{
      ...font.bodySemi,
      fontSize,
      lineHeight: 1.25,
      color: color.text2,
      textAlign: 'center',
      textWrap: 'balance',
      maxWidth: 900,
    }}
  >
    {children}
  </div>
);

/* The cold open: the moment every student knows. A pager blink, the attending's
   question, and nothing to say. Then the title. The same question comes back
   in the list scene, where the student gets three of five. */
const HOOK = {
  where: 'Morning rounds, 6:42 am',
  question: 'Name five causes of an anion gap acidosis.',
  beat: 'Everyone is waiting.',
};
const BLINK = 12;
const WHERE_IN = 28;
const QUESTION_IN = 40;
const QUESTION_DONE = QUESTION_IN + 30;
const BEAT_IN = 88;
const HOOK_OUT = 114;
const TITLE_IN = 124;

const Intro = ({ frame, spec }: { frame: number; spec: LayoutSpec }) => {
  // Two frames on, then a fade.
  const blink = frame < BLINK ? 0 : frame < BLINK + 2 ? 1 : 1 - ramp(frame, BLINK + 2, 12);
  const hook = 1 - ramp(frame, HOOK_OUT);
  const title = easeOut(ramp(frame, TITLE_IN));
  const out = 1 - ramp(frame, intro.to - FADE);
  // The caret waits for an answer that doesn't come.
  const caretOn = frame >= QUESTION_DONE && Math.floor((frame - QUESTION_DONE) / 8) % 2 === 0;

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: 120,
            height: 44,
            borderRadius: radius.rung,
            background: color.signal,
            opacity: blink,
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: hook }}>
        <div style={{ width: spec.hookWidth }}>
          <div
            style={{
              ...font.bodySemi,
              fontSize: spec.lineSize,
              lineHeight: 1.25,
              color: color.text3,
              opacity: ramp(frame, WHERE_IN),
            }}
          >
            {HOOK.where}
          </div>
          <div
            style={{
              ...font.display,
              fontSize: spec.hookSize,
              lineHeight: 1.08,
              letterSpacing: '-0.01em',
              color: color.text,
              marginTop: 28,
            }}
          >
            <Words value={HOOK.question} shown={wordsShown(frame, QUESTION_IN)} />
            <span
              style={{
                display: 'inline-block',
                width: spec.hookSize * 0.07,
                height: spec.hookSize * 0.74,
                marginLeft: 4,
                verticalAlign: 'baseline',
                background: color.signal,
                opacity: caretOn ? 1 : 0,
              }}
            />
          </div>
          <div
            style={{
              ...font.bodySemi,
              fontSize: spec.lineSize,
              lineHeight: 1.25,
              color: color.text2,
              marginTop: 44,
              opacity: ramp(frame, BEAT_IN),
            }}
          >
            {HOOK.beat}
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
          opacity: title,
          transform: `translateY(${(1 - title) * 16}px)`,
        }}
      >
        <Wordmark fontSize={spec.wordmarkSize} />
        <Line fontSize={spec.lineSize}>{TAGLINE}</Line>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** The end card: wordmark and the closing line. Fades out over the last 10 frames. */
const EndCard = ({ frame, spec }: { frame: number; spec: LayoutSpec }) => {
  const opacity = ramp(frame, end.from) * (1 - ramp(frame, end.to - 10, 10));
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 36, opacity }}>
      <Wordmark fontSize={spec.wordmarkSize} />
      <Line fontSize={spec.lineSize}>{END_CARD_LINE}</Line>
    </AbsoluteFill>
  );
};

/** On-screen caption, outside the phone: Archivo 600, one at a time. */
const Caption = ({ frame, spec }: { frame: number; spec: LayoutSpec }) => {
  const current = sceneAt(frame);
  if (!current.caption) return null;
  const enter = easeOut(ramp(frame, current.from + 4, 8));
  const exit = 1 - ramp(frame, current.to - 8, 8);
  const sentences = current.caption.split(/(?<=\.)\s+/);
  return (
    <div
      style={{
        position: 'absolute',
        display: 'flex',
        alignItems: 'center',
        // The backdrop colour, so a pushed-in phone never runs under the words.
        background: color.bg,
        ...font.bodySemi,
        color: color.text,
        ...spec.caption,
      }}
    >
      {/* Each sentence stays together, so lines break between sentences first. */}
      <span
        style={{ width: '100%', opacity: enter * exit, transform: `translateY(${(1 - enter) * 14}px)` }}
      >
        {sentences.map((sentence, i) => (
          <span key={sentence} style={{ display: 'inline-block', textWrap: 'balance' }}>
            {sentence}
            {i < sentences.length - 1 ? ' ' : ''}
          </span>
        ))}
      </span>
    </div>
  );
};

/** A screen that fades in over the one before it. */
const Layer = ({ opacity = 1, children }: { opacity?: number; children: ReactNode }) => (
  <div style={{ position: 'absolute', inset: 0, opacity }}>{children}</div>
);

const during = (frame: number, from: number, to: number): boolean =>
  frame >= from && frame < to + FADE;

const PhoneStage = ({ frame, spec }: { frame: number; spec: LayoutSpec }) => {
  const { width, height } = useVideoConfig();
  const fit = (height * spec.phoneHeight) / PHONE_H;
  const top = height - PHONE_H * fit - spec.phoneBottom;

  const enter = easeOut(ramp(frame, session.from));
  const exit = 1 - ramp(frame, end.from);
  // The camera pushes in from the top edge, so the status bar stays put and
  // the lower part of the screen runs off the frame.
  const scale = fit * cameraZoom(frame);

  return (
    <div
      style={{
        position: 'absolute',
        left: width * spec.phoneCenterX - PHONE_W / 2,
        top,
        transformOrigin: `${PHONE_W / 2}px 0`,
        transform: `translateY(${(1 - enter) * 24}px) scale(${scale})`,
        opacity: enter * exit,
      }}
    >
      <Phone>
        {frame < SESSION_START + FADE ? (
          <Layer>
            <HomeScreen sinceTap={frame - HOME_TAP} />
          </Layer>
        ) : null}
        {during(frame, SESSION_START, result.from) ? (
          <Layer opacity={ramp(frame, SESSION_START)}>
            <SessionScreen frame={frame} />
          </Layer>
        ) : null}
        {during(frame, result.from, result.to) ? (
          <Layer opacity={ramp(frame, result.from)}>
            <MissResultScreen f={frame - result.from} />
          </Layer>
        ) : null}
        {during(frame, list.from, list.to) ? (
          <Layer opacity={ramp(frame, list.from)}>
            <ListFeedbackScreen f={frame - list.from} />
          </Layer>
        ) : null}
        {during(frame, log.from, log.to) ? (
          <Layer opacity={ramp(frame, log.from)}>
            <LogScreen f={frame - log.from} />
          </Layer>
        ) : null}
        {during(frame, review.from, review.to) ? (
          <Layer opacity={ramp(frame, review.from)}>
            <ReviewScreen f={frame - review.from} />
          </Layer>
        ) : null}
        {/* The clean run cuts (no fade) to the promotion screen. */}
        {frame >= promotion.from && frame < PROMOTION_CUT ? (
          <Layer opacity={ramp(frame, promotion.from)}>
            <CleanResultScreen f={frame - promotion.from} />
          </Layer>
        ) : null}
        {frame >= PROMOTION_CUT ? (
          <Layer>
            <PromotionScreen f={frame - PROMOTION_CUT} />
          </Layer>
        ) : null}
      </Phone>
    </div>
  );
};

export const Vision = ({ layout }: { layout: Layout }) => {
  const frame = useCurrentFrame();
  const spec = LAYOUTS[layout];

  return (
    <AbsoluteFill style={{ background: color.bg }}>
      {frame < intro.to ? <Intro frame={frame} spec={spec} /> : null}
      {frame >= session.from && frame < end.from + FADE ? <PhoneStage frame={frame} spec={spec} /> : null}
      <Caption frame={frame} spec={spec} />
      {frame >= end.from ? <EndCard frame={frame} spec={spec} /> : null}
    </AbsoluteFill>
  );
};
