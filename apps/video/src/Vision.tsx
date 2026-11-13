import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { ListFeedbackScreen } from './screens/ListFeedback.tsx';
import { LogScreen } from './screens/Log.tsx';
import { PromotionScreen } from './screens/Promotion.tsx';
import { ResultScreen } from './screens/Result.tsx';
import { ReviewScreen } from './screens/Review.tsx';
import { SessionScreen } from './screens/Session.tsx';
import { color, font, radius } from './theme.ts';
import {
  END_CARD_LINE,
  FADE,
  PROMOTION_CUT,
  easeOut,
  ramp,
  scene,
  sceneAt,
} from './timeline.ts';
import { PHONE_H, PHONE_W, Phone } from './ui.tsx';

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
  endLineSize: number;
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
      height: 230,
      fontSize: 60,
      lineHeight: '70px',
      textAlign: 'center',
      justifyContent: 'center',
    },
    wordmarkSize: 230,
    endLineSize: 46,
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
      justifyContent: 'flex-start',
    },
    wordmarkSize: 230,
    endLineSize: 46,
  },
};

const intro = scene('intro');
const session = scene('session');
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

/** Scene 1: one amber pager blink, then the wordmark. */
const Intro = ({ frame, spec }: { frame: number; spec: LayoutSpec }) => {
  const BLINK = 30;
  // Two frames on, then a fade.
  const blink = frame < BLINK ? 0 : frame < BLINK + 2 ? 1 : 1 - ramp(frame, BLINK + 2, 12);
  const wordmarkIn = easeOut(ramp(frame, 46));
  const out = 1 - ramp(frame, intro.to - FADE);

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: out }}>
      <div
        style={{
          position: 'absolute',
          width: 120,
          height: 44,
          borderRadius: radius.rung,
          background: color.signal,
          opacity: blink,
        }}
      />
      <div style={{ opacity: wordmarkIn, transform: `translateY(${(1 - wordmarkIn) * 16}px)` }}>
        <Wordmark fontSize={spec.wordmarkSize} />
      </div>
    </AbsoluteFill>
  );
};

/** Scene 8: wordmark and the closing line. Fades out over the last 10 frames. */
const EndCard = ({ frame, spec }: { frame: number; spec: LayoutSpec }) => {
  const opacity = ramp(frame, end.from) * (1 - ramp(frame, end.to - 10, 10));
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 36, opacity }}>
      <Wordmark fontSize={spec.wordmarkSize} />
      <div
        style={{
          ...font.bodySemi,
          fontSize: spec.endLineSize,
          lineHeight: 1.25,
          color: color.text2,
          textAlign: 'center',
          textWrap: 'balance',
          maxWidth: 900,
        }}
      >
        {END_CARD_LINE}
      </div>
    </AbsoluteFill>
  );
};

/** On-screen caption, outside the phone: Archivo 600, one at a time. */
const Caption = ({ frame, spec }: { frame: number; spec: LayoutSpec }) => {
  const current = sceneAt(frame);
  if (!current.caption) return null;
  const enter = easeOut(ramp(frame, current.from + 4, 8));
  const exit = 1 - ramp(frame, current.to - 8, 8);
  return (
    <div
      style={{
        position: 'absolute',
        display: 'flex',
        alignItems: 'center',
        ...font.bodySemi,
        color: color.text,
        opacity: enter * exit,
        transform: `translateY(${(1 - enter) * 14}px)`,
        ...spec.caption,
      }}
    >
      {/* Each sentence stays together, so lines break between sentences first. */}
      <span style={{ width: '100%' }}>
        {current.caption.split(/(?<=\.)\s+/).map((sentence) => (
          <span key={sentence} style={{ display: 'inline-block', textWrap: 'balance' }}>
            {sentence}&nbsp;
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
  const scale = (height * spec.phoneHeight) / PHONE_H;
  const left = width * spec.phoneCenterX - (PHONE_W * scale) / 2;
  const top = height - PHONE_H * scale - spec.phoneBottom;

  const enter = easeOut(ramp(frame, session.from));
  const exit = 1 - ramp(frame, end.from);

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        transformOrigin: '0 0',
        transform: `translateY(${(1 - enter) * 24}px) scale(${scale})`,
        opacity: enter * exit,
      }}
    >
      <Phone>
        {during(frame, session.from, list.from) ? (
          <Layer>
            <SessionScreen frame={frame} />
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
        {/* The result cuts (no fade) to the promotion screen. */}
        {frame >= promotion.from && frame < PROMOTION_CUT ? (
          <Layer opacity={ramp(frame, promotion.from)}>
            <ResultScreen f={frame - promotion.from} />
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
