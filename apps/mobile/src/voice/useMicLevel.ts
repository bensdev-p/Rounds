/**
 * The mic level for the waveform. Frames arrive every 20 ms; the screen
 * updates about 15 times a second, rising fast and falling slowly.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/** Speech at a normal distance peaks around this RMS. */
const FULL_SCALE = 0.12;
const FRAME_MS = 66;

export function useMicLevel(active: boolean): [number, (rms: number) => void] {
  const peak = useRef(0);
  const [level, setLevel] = useState(0);
  const push = useCallback((rms: number) => {
    peak.current = Math.max(peak.current, Math.min(1, rms / FULL_SCALE));
  }, []);
  useEffect(() => {
    peak.current = 0;
    if (!active) return;
    const timer = setInterval(() => {
      setLevel((shown) => {
        const next = Math.max(peak.current, shown * 0.7);
        peak.current = 0;
        return next < 0.02 ? 0 : next;
      });
    }, FRAME_MS);
    return () => clearInterval(timer);
  }, [active]);
  return [active ? level : 0, push];
}
