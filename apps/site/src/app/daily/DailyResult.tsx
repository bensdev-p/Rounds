'use client';
import { dailyShareText, dailySquares, longDay, shortDay, type DayKey } from '@rounds/shared';
import { Check, Share } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Ladder, type RungState } from '../../components/Ladder.tsx';
import { site } from '../../lib/site.ts';
import type { SavedRun } from './saved.ts';

/** The result (mockups daily-result-desktop, daily-result-phone). */
export function DailyResult({ day, run }: { day: DayKey; run: SavedRun }) {
  const squares = dailySquares(run);
  const states: RungState[] = squares.map((s) =>
    s === 'cleared' ? 'done' : s === 'missed' ? 'miss' : '',
  );

  return (
    <div className="split">
      <div className="stack-lg">
        <p className="meta">{longDay(day)}</p>
        <div className="daily-score">
          <Ladder states={states} width={150} />
          <div style={{ paddingBottom: 4 }}>
            <p className="num" style={{ fontSize: 88, lineHeight: 0.9 }}>
              {run.cleared}
            </p>
            <p className="meta mt8">{run.cleared === 1 ? 'rung climbed' : 'rungs climbed'}</p>
          </div>
        </div>
        {run.miss ? (
          <div className="card" style={{ maxWidth: 520 }}>
            <p className="small">{run.miss.label}</p>
            <p style={{ marginTop: 6, fontSize: 15, lineHeight: '21px' }}>
              {run.miss.quote ? (
                <>
                  You said <span className="tmiss">&ldquo;{run.miss.quote}&rdquo;</span>{' '}
                </>
              ) : null}
              {run.miss.correction}
            </p>
          </div>
        ) : (
          <div className="card" style={{ maxWidth: 520 }}>
            <p className="small">Clean run</p>
            <p style={{ marginTop: 6, fontSize: 15, lineHeight: '21px' }}>
              Every rung, no misses. The attending has nothing left to ask.
            </p>
          </div>
        )}
        <p className="small">A new pimp tomorrow.</p>
      </div>
      <ShareCard day={day} run={run} squares={squares} />
    </div>
  );
}

function ShareCard({
  day,
  run,
  squares,
}: {
  day: DayKey;
  run: SavedRun;
  squares: ReturnType<typeof dailySquares>;
}) {
  const [copied, setCopied] = useState(false);
  const text = dailyShareText(day, run, site.domain);

  async function share() {
    // The squares and the score only: never the script, questions or answers.
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Copy your result', text);
    }
  }

  return (
    <div className="stack-lg daily-share">
      <div
        className="sharecard"
        role="img"
        aria-label={`PimpMe, ${shortDay(day)}: ${run.cleared} of ${run.total}`}
      >
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end' }}>
          <div className="sq">
            {squares.map((s, i) => (
              <i key={i} className={s === 'cleared' ? 'done' : s === 'missed' ? 'miss' : ''} />
            ))}
          </div>
          <div>
            <p className="small">PimpMe · {shortDay(day)}</p>
            <p className="num" style={{ fontSize: 56, lineHeight: 1, marginTop: 6 }}>
              {run.cleared}
              <span className="t3" style={{ fontSize: 28 }}>
                {' '}
                / {run.total}
              </span>
            </p>
            <p className="small mt8">{site.domain}/daily</p>
          </div>
        </div>
      </div>
      <p className="small center" style={{ maxWidth: 280 }}>
        The share shows the squares only, never the script, questions or answers.
      </p>
      <div className="btns" style={{ width: 280 }}>
        <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={share}>
          {copied ? <Check aria-hidden="true" /> : <Share aria-hidden="true" />}
          {copied ? 'Copied' : 'Share result'}
        </button>
        <Link className="btn btn-quiet" style={{ width: '100%' }} href={site.webApp}>
          Get the full app
        </Link>
      </div>
      <p className="sr-only" role="status">
        {copied ? 'Result copied' : ''}
      </p>
    </div>
  );
}
