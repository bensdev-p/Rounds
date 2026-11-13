import { Composition } from 'remotion';
import { loadFonts } from './fonts.ts';
import { DURATION, FPS } from './timeline.ts';
import { Vision } from './Vision.tsx';

loadFonts();

export const Root = () => (
  <>
    <Composition
      id="VisionVertical"
      component={Vision}
      durationInFrames={DURATION}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{ layout: 'vertical' as const }}
    />
    <Composition
      id="VisionWide"
      component={Vision}
      durationInFrames={DURATION}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ layout: 'wide' as const }}
    />
  </>
);
