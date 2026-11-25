import { Check, ChevronRight, Download, X } from 'lucide-react';
import type { Metadata } from 'next';
import { site } from '../../lib/site.ts';

export const metadata: Metadata = {
  title: 'Anki add-on',
  description:
    'The PimpMe add-on for Anki: a miss in PimpMe unsuspends the AnKing cards linked to it.',
};

const DOES = [
  'Unsuspends the cards linked to what you missed',
  'Tags those notes #PimpMe::missed',
  'Syncs when Anki opens and closes',
  'Puts each sync in one step you can undo',
  'Sends review numbers for linked cards: ids, due date, interval, lapses',
];

const NEVER = [
  'Read or upload card text, card fronts or note fields',
  'Touch cards you haven’t missed on',
  'Ask for a password in Anki',
  'Run in AnkiMobile on the iPhone',
];

export default function Anki() {
  return (
    <>
      <section className="section">
        <div className="wrap split">
          <div className="stack-lg">
            <h1 className="t-page">PimpMe for Anki</h1>
            <p className="lede measure">Miss it on rounds, see it in Anki.</p>
            <p className="body t2 measure">
              A small add-on for Anki on your computer. When you miss a question in PimpMe, it
              unsuspends the AnKing cards linked to that part of the script, so they turn up in your
              next review.
            </p>
            <div className="btns">
              <a className="btn btn-primary" href={site.addonFile} download="pimpme.ankiaddon">
                <Download aria-hidden="true" />
                Download the add-on
              </a>
            </div>
            <p className="small">
              For Anki on Windows, macOS and Linux. Works with the AnKing deck from AnkiHub.
            </p>
          </div>
          <div className="cols two">
            <div>
              <h2 className="h3">What it does</h2>
              <ul className="ticks yes mt16">
                {DOES.map((d) => (
                  <li key={d}>
                    <Check aria-hidden="true" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="h3">What it never does</h2>
              <ul className="ticks no mt16">
                {NEVER.map((d) => (
                  <li key={d}>
                    <X aria-hidden="true" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap split top-align">
          <div className="stack-lg">
            <h2 className="h1">Set it up once</h2>
            <ol className="howto mt12">
              <li>
                <span className="stepn">1</span>
                <div>
                  <h3 className="h3">Download</h3>
                  <p className="body t2 mt8">
                    Get <b className="strong">pimpme.ankiaddon</b> with the button above.
                  </p>
                </div>
              </li>
              <li>
                <span className="stepn">2</span>
                <div>
                  <h3 className="h3">Install by double-clicking</h3>
                  <p className="body t2 mt8">
                    Anki opens and asks to install it. Restart Anki when it&apos;s done.
                  </p>
                </div>
              </li>
              <li>
                <span className="stepn">3</span>
                <div>
                  <h3 className="h3">Get a code</h3>
                  <p className="body t2 mt8">
                    In PimpMe, open <span className="kbd">Settings → Anki</span> and tap Connect
                    Anki. You&apos;ll see a code that works once, for 10 minutes.
                  </p>
                </div>
              </li>
              <li>
                <span className="stepn">4</span>
                <div>
                  <h3 className="h3">Enter it in Anki</h3>
                  <p className="body t2 mt8">
                    In Anki, choose <span className="kbd">Tools → PimpMe → Connect to PimpMe…</span>{' '}
                    and type the code. That&apos;s it.
                  </p>
                </div>
              </li>
            </ol>
          </div>
          <div className="stack" aria-label="Example: Settings → Anki in PimpMe">
            <p className="small">In PimpMe: Settings → Anki</p>
            <div className="card" style={{ padding: 18 }}>
              <p className="body">See what you missed on rounds in your Anki.</p>
              <p className="small mt8">
                For Anki on a computer. PimpMe reads card ids, never card text.
              </p>
              <span className="btn btn-primary btn-block mt16" aria-hidden="true">
                Connect Anki
              </span>
              <p className="meta mt12">
                Install the PimpMe add-on, then enter this code:{' '}
                <span className="code">ABCD-2345</span>
              </p>
              <p className="small mt8">Works once, for 9 more min.</p>
            </div>
            <p className="small" style={{ marginTop: 20 }}>
              Disconnect from either side: Settings → Anki → Disconnect in PimpMe, or Tools → PimpMe
              → Disconnect in Anki.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap split">
          <div className="stack">
            <p className="small">On the result screen, after a miss on management</p>
            <div className="list" aria-hidden="true">
              <div className="lrow">
                <div className="grow">
                  <p style={{ fontWeight: 500 }}>Unsuspend 3 Anki cards</p>
                  <p className="small">Syncs next time Anki opens</p>
                </div>
                <ChevronRight />
              </div>
            </div>
            <div className="card outline mt12">
              <p className="small">Linked notes, acute pancreatitis, management</p>
              <p className="ids mt8">1495670579999 · 1532131804405 · 1535304077148</p>
            </div>
          </div>
          <div className="stack-lg first-on-phone">
            <h2 className="h1">What &ldquo;Unsuspend 3 Anki cards&rdquo; means</h2>
            <p className="body t2 measure">
              Each script is linked to AnKing notes by id, rung by rung. When a session ends on a
              miss, the result offers the cards linked to that rung. Tap it, and the next time Anki
              opens they&apos;re unsuspended and tagged, ready in your reviews.
            </p>
            <p className="body t2 measure">
              Changed your mind? In Anki, <span className="kbd">Edit → Undo</span> puts the whole
              sync back in one step.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
