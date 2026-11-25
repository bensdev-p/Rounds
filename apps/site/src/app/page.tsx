import { ChevronRight, Info, Lock, Mic, RefreshCw, Stethoscope } from 'lucide-react';
import Link from 'next/link';
import { GetStarted } from '../components/Buttons.tsx';
import { Ladder } from '../components/Ladder.tsx';

// Waveform bar heights, as drawn.
const WAVE = [10, 18, 30, 22, 40, 28, 14, 34, 24, 12, 20, 8, 16, 26, 12];

export default function Home() {
  return (
    <>
      <section className="section">
        <div className="wrap split">
          <div className="stack-lg">
            <p className="eyebrow">For third- and fourth-year medical students</p>
            <h1 className="t-hero">Get pimped here first.</h1>
            <p className="lede">Your attending is going to ask. Practice before they do.</p>
            <p className="body t2 measure">
              Pimping without the humiliation. An AI attending asks out loud, one rung harder each
              time, until you miss. Nobody&apos;s watching, nothing&apos;s graded but you, and the
              miss is waiting in your review tonight.
            </p>
            <GetStarted />
          </div>
          <div className="panel" aria-label="Example: a live session">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="meta">Internist</span>
              <span className="num t2" style={{ fontSize: 18 }}>
                0:42
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 28,
                marginTop: 22,
                alignItems: 'flex-start',
                flexWrap: 'wrap',
              }}
            >
              <Ladder states={['done', 'done', 'now', '', '', '']} width={180} />
              <div style={{ flex: 1, minWidth: 220 }}>
                <p className="meta">Acute pancreatitis</p>
                <p className="q mt8">
                  How would you tell gallstone pancreatitis from alcoholic pancreatitis at the
                  bedside?
                </p>
              </div>
            </div>
            <p
              className="mt26"
              style={{ fontSize: 15, lineHeight: '21px', color: 'var(--text-2)', minHeight: 63 }}
            >
              &ldquo;I&apos;d check the ALT. If it&apos;s more than three times normal, that points
              to gallstones, and then right upper quadrant…
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2 className="h1">One day on the wards</h2>
          <p className="body t2 mt12 measure">
            Three short habits that fit around rounds, not on top of them.
          </p>
          <div className="cols mt40">
            <div className="stack">
              <span className="stepno">1</span>
              <p className="meta">Morning, about five minutes</p>
              <h3 className="h2">Get pimped</h3>
              <p className="body t2">
                Before rounds, the attending pimps you on your rotation or a patient you logged.
                Climb until you miss.
              </p>
              <div style={{ paddingTop: 8 }}>
                <div className="strip" aria-label="Rungs 1 to 4 passed, missed on 5">
                  <i className="done">1</i>
                  <i className="done">2</i>
                  <i className="done">3</i>
                  <i className="done">4</i>
                  <i className="miss">5</i>
                  <i>6</i>
                </div>
              </div>
            </div>
            <div className="stack">
              <span className="stepno">2</span>
              <p className="meta">On the wards, ten seconds</p>
              <h3 className="h2">Log a patient</h3>
              <p className="body t2">
                Save the diagnosis, never the patient. Tonight it becomes a short ladder of its own.
              </p>
              <div
                style={{ paddingTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}
                aria-hidden="true"
              >
                <div className="field on-surface" style={{ flex: 1, minHeight: 44, fontSize: 15 }}>
                  Heart failure exacerbation
                </div>
                <span className="chip">Save</span>
              </div>
            </div>
            <div className="stack">
              <span className="stepno">3</span>
              <p className="meta">Evening, about twelve minutes</p>
              <h3 className="h2">Review what you missed</h3>
              <p className="body t2">
                Today&apos;s misses, the script behind each one, and the Anki cards to match. It
                ends instead of scrolling forever.
              </p>
              <div style={{ paddingTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="mark" />
                <div>
                  <p style={{ fontWeight: 500, fontSize: 15 }}>Acute pancreatitis</p>
                  <p className="small">Pimped on management</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap split">
          <div className="stack-lg">
            <h2 className="h1">Answer out loud, like it&apos;s real.</h2>
            <p className="body t2 measure">
              PimpMe asks the way an attending does, and you answer the way you would at the
              bedside. The mic opens when the question ends. Rather type? Text works everywhere.
            </p>
            <div className="measure">
              <h3 className="h3">Who&apos;s pimping?</h3>
              <div className="seg mt12" aria-hidden="true">
                <span>Teacher</span>
                <span>Surgeon</span>
                <span className="on">Internist</span>
              </div>
              <p className="small mt12">
                Three ways to get pimped: the Teacher waits, the Internist asks why, the Surgeon
                gives you ten seconds.
              </p>
            </div>
          </div>
          <div>
            <p className="meta">Acute pancreatitis</p>
            <p className="q mt8">What are the two most common causes of acute pancreatitis?</p>
            <div className="panel mt26" style={{ padding: '16px 18px', borderRadius: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }} aria-hidden="true">
                <span className="mic">
                  <Mic />
                </span>
                <div className="wave">
                  {WAVE.map((h, i) => (
                    <i key={i} style={{ height: h }} />
                  ))}
                </div>
              </div>
              <p
                className="mt12"
                style={{ fontSize: 15, color: 'var(--text-2)', minHeight: 63, lineHeight: '21px' }}
              >
                &ldquo;Gallstones first, then heavy alcohol use.&rdquo;
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap split">
          <div className="stack" aria-hidden="true">
            <div className="list">
              <div className="lrow">
                <div className="grow">
                  <p style={{ fontWeight: 500 }}>Unsuspend 3 Anki cards</p>
                  <p className="small">Syncs next time Anki opens</p>
                </div>
                <ChevronRight />
              </div>
            </div>
            <div className="info">
              <RefreshCw />
              <p>3 Anki cards unsuspended today. They&apos;ll show up next time you open Anki.</p>
            </div>
          </div>
          <div className="stack-lg first-on-phone">
            <h2 className="h1">Your misses, waiting in Anki.</h2>
            <p className="body t2 measure">
              Connect the PimpMe add-on and a miss unsuspends the matching AnKing cards, so they
              turn up in your next review. PimpMe reads card ids, never card text.
            </p>
            <Link className="link" href="/anki">
              How the Anki add-on works <ChevronRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap split">
          <div className="stack-lg">
            <h2 className="h1">Pimped on real medicine, not trivia.</h2>
            <p className="body t2 measure">
              Each question and accepted answer traces to an illness script, and a physician reviews
              every script before anyone is asked from it. Grading checks your answer against the
              script, nothing else.
            </p>
            <ul className="ticks no measure">
              <li>
                <Stethoscope aria-hidden="true" />
                <span>Scripts reviewed by a physician, named on every script.</span>
              </li>
              <li>
                <Info aria-hidden="true" />
                <span>Educational use only, not clinical guidance.</span>
              </li>
              <li>
                <Lock aria-hidden="true" />
                <span>
                  No patient details. The log keeps a diagnosis, never a name, date or record
                  number.
                </span>
              </li>
            </ul>
          </div>
          <div
            className="panel"
            style={{ padding: '24px 28px 14px' }}
            aria-label="Example: an illness script"
          >
            <p className="h1">Acute pancreatitis</p>
            <p className="small mt8">
              Example script. Each approved script names its reviewer here.
            </p>
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              <span className="chip">Internal medicine</span>
              <span className="chip">Surgery</span>
            </div>
            <div className="mt16">
              <div className="script-block">
                <p className="k">Key findings</p>
                <p>
                  Sudden epigastric pain radiating to the back, nausea and vomiting, recent heavy
                  alcohol use or known gallstones.
                </p>
              </div>
              <div className="script-block">
                <p className="k">Management</p>
                <p>
                  Early goal-directed IV fluids with lactated Ringer&apos;s, pain control, early
                  oral feeding as tolerated.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section band">
        <div className="wrap center stack-lg">
          <h2 className="t-page" style={{ maxWidth: 860, marginLeft: 'auto', marginRight: 'auto' }}>
            Pimp yourself before rounds does.
          </h2>
          <GetStarted />
        </div>
      </section>
    </>
  );
}
