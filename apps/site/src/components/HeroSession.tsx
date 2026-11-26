'use client';

import { RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { EXAMPLE_CLIMB, EXAMPLE_MISS, EXAMPLE_SCRIPT } from '../lib/example.ts';
import { heroTimeline, words, type HeroEvent } from '../lib/heroTimeline.ts';
import { Ladder, type RungState } from './Ladder.tsx';

/** Seconds an answer for the Internist (How it works → personas). */
const ANSWER_SECONDS = 30;

interface View {
  rung: number;
  /** Words of the question and answer shown so far; null shows the whole text. */
  q: number | null;
  a: number | null;
  passed: number;
  missed: boolean;
  ended: boolean;
}

/** What the mockup draws, and what shows without JavaScript or with Reduce Motion. */
const DRAWN: View = { rung: 2, q: null, a: null, passed: 2, missed: false, ended: false };
const START: View = { rung: 0, q: 0, a: 0, passed: 0, missed: false, ended: false };

function apply(view: View, e: HeroEvent): View {
  switch (e.kind) {
    case 'question':
      return { ...view, rung: e.rung, q: e.words };
    case 'answer':
      return { ...view, a: e.words };
    case 'pass':
      return { ...view, passed: e.rung + 1 };
    case 'miss':
      return { ...view, missed: true };
    case 'next':
      return { ...view, rung: e.rung, q: 0, a: 0 };
    case 'end':
      return { ...view, ended: true };
  }
}

const show = (text: string, n: number | null) =>
  n === null ? text : words(text).slice(0, n).join(' ');

/**
 * The Home hero panel, playing one short session (developer's decision, 26 Nov 2026):
 * four rungs passed, pimped on management. It plays once when it comes into view, and
 * "Watch again" replays it. Reduce Motion keeps the drawn, still panel.
 */
export function HeroSession() {
  const [view, setView] = useState<View>(DRAWN);
  const [seconds, setSeconds] = useState(42);
  const [run, setRun] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const [animate, setAnimate] = useState(false);

  // Start once the panel is on screen, unless the visitor prefers reduced motion.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = panel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setAnimate(true);
          setRun(1);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Play the timeline for this run.
  useEffect(() => {
    if (run === 0) return;
    setView(START);
    const timers = heroTimeline(EXAMPLE_CLIMB, EXAMPLE_MISS.rung).map((e) =>
      window.setTimeout(() => setView((v) => apply(v, e)), e.at + 300),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [run]);

  // Each rung's answer clock counts down while that rung is live.
  useEffect(() => {
    if (run === 0) return;
    setSeconds(ANSWER_SECONDS);
    const tick = window.setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(tick);
  }, [run, view.rung]);

  const states: RungState[] = [0, 1, 2, 3, 4, 5].map((i) => {
    if (i < view.passed) return 'done';
    if (i === view.rung) return view.missed ? 'miss' : 'now';
    return '';
  });
  const step = EXAMPLE_CLIMB[view.rung] ?? { q: '', a: null };

  return (
    <div className={`panel${animate ? ' hero-live' : ''}`} ref={panel}>
      <p className="sr-only">
        Example session with the Internist on {EXAMPLE_SCRIPT.toLowerCase()}: four rungs passed,
        then pimped on management.
      </p>
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            minHeight: 24,
          }}
        >
          <span className="meta" aria-hidden="true">
            Internist
          </span>
          {view.ended ? (
            <button type="button" className="link" onClick={() => setRun((r) => r + 1)}>
              <RotateCcw aria-hidden="true" />
              Watch again
            </button>
          ) : (
            <span className="num t2" style={{ fontSize: 18 }} aria-hidden="true">
              0:{String(seconds).padStart(2, '0')}
            </span>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 28,
            marginTop: 22,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
          }}
          aria-hidden="true"
        >
          <Ladder states={states} width={180} />
          <div className="hero-q" style={{ flex: 1, minWidth: 220 }}>
            <p className="meta">{EXAMPLE_SCRIPT}</p>
            <p className="q mt8">{show(step.q, view.q)}</p>
          </div>
        </div>
        <div className="mt26 hero-a" aria-hidden="true">
          <p className={view.missed ? 'tmiss' : undefined}>{show(step.a ?? '', view.a)}</p>
          {view.missed ? (
            <p className="ttext mt8">
              <span className="small">{EXAMPLE_MISS.label}.</span> {EXAMPLE_MISS.script}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
