import { color, font } from '../theme.ts';
import { PROMOTION_RISE_FRAMES, easeOut, ramp } from '../timeline.ts';
import { Button, CloseButton, Screen, text } from '../ui.tsx';

/* Promotion (mockup: promo.png). Second half of scene 7. */
const RANKS = ['MS3', 'Sub-I', 'Intern', 'Resident', 'Chief', 'Attending'] as const;
const STEP_HEIGHTS = [18, 30, 42, 54, 66, 78] as const;
const NEW_RANK = 3; // Resident

const RISE_START = 6;

/** `f` is the frame since the cut to this screen. */
export const PromotionScreen = ({ f }: { f: number }) => {
  // Hero moment 2: the new rank step rises into place over 400 ms.
  const rise = easeOut(ramp(f, RISE_START, PROMOTION_RISE_FRAMES));
  const landed = rise >= 1;

  return (
    <Screen padding="8px 28px 28px">
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <CloseButton />
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, alignItems: 'end' }}>
        {STEP_HEIGHTS.map((height, i) => (
          <i
            key={i}
            style={{
              display: 'block',
              borderRadius: 4,
              height: i === NEW_RANK ? height * rise : height,
              background: i <= NEW_RANK ? color.signal : color.surface2,
              ...(i === NEW_RANK && landed
                ? { outline: `2px solid ${color.text}`, outlineOffset: 2 }
                : {}),
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 4,
          marginTop: 8,
          fontSize: 10.5,
          lineHeight: '13px',
        }}
      >
        {RANKS.map((rank, i) => (
          <span
            key={rank}
            style={
              i === NEW_RANK && landed
                ? { ...font.bodySemi, color: color.text }
                : { ...font.bodyMedium, color: color.text3 }
            }
          >
            {rank}
          </span>
        ))}
      </div>
      <div style={{ ...text.meta, marginTop: 34 }}>Promoted</div>
      <div style={{ ...font.display, letterSpacing: '-0.01em', fontSize: 64, lineHeight: '61px', marginTop: 6 }}>
        Resident
      </div>
      <div style={{ ...text.body, marginTop: 18, color: color.text2 }}>
        1,200 rungs climbed since September. Chief resident is at 2,500.
      </div>
      <div style={{ ...text.body, marginTop: 22 }}>
        "Congratulations. You're still presenting to me at six."
      </div>
      <div style={{ ...text.small, marginTop: 4 }}>The Internist</div>
      <div style={{ flex: 1 }} />
      <Button variant="primary">Back to rounds</Button>
    </Screen>
  );
};
