import { Check, ChevronRight, Minus } from 'lucide-react';
import type { Metadata } from 'next';
import { GetStarted } from '../../components/Buttons.tsx';
import { Ladder, RUNGS } from '../../components/Ladder.tsx';
import { EXAMPLE_CLIMB as CLIMB } from '../../lib/example.ts';

export const metadata: Metadata = { title: 'How it works' };

const PERSONAS = [
  { name: 'Teacher', how: 'Pimps gently. Gives hints and waits for you.', pace: 'No time limit' },
  {
    name: 'Internist',
    how: 'Pimps Socratically. Asks why, then asks again.',
    pace: '30 seconds an answer',
  },
  {
    name: 'Surgeon',
    how: 'Pimps fast. Short questions, short patience.',
    pace: '10 seconds an answer',
  },
];

const SHIFTS = [
  'l2',
  'l3',
  'l1',
  'l3',
  'off',
  'l2',
  'l3',
  'l3',
  'l2',
  'l3',
  'off',
  'l1',
  'l3',
  'l2',
];
const RANKS = ['MS3', 'Sub-I', 'Intern', 'Resident', 'Chief', 'Attending'];

export default function HowItWorks() {
  return (
    <>
      <section className="section" style={{ paddingBottom: 0 }}>
        <div className="wrap stack-lg">
          <h1 className="t-page">How it works</h1>
          <p className="lede measure">One script, six rungs, pimped the way attendings pimp.</p>
        </div>
      </section>

      <section className="section tight" style={{ paddingTop: 64 }}>
        <div className="wrap split top-align wide-right">
          <div className="stack-lg">
            <h2 className="h1">The pimp ladder</h2>
            <p className="body t2">
              Each session takes one illness script and climbs it: recall, the next most common,
              telling it apart, workup, management, then a pearl. Every rung is harder than the
              last.
            </p>
            <p className="body t2">
              The session ends on your first miss. The rung you reach is your score, and your best
              rung on each script is kept.
            </p>
            <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
              <p className="num" style={{ fontSize: 88, lineHeight: 0.9 }}>
                4
              </p>
              <div style={{ paddingBottom: 6 }}>
                <p className="meta">rungs climbed</p>
                <p className="small">The example on the right, missed on management</p>
              </div>
            </div>
          </div>
          <ol className="climb" aria-label="An example session, rung 1 at the bottom">
            {CLIMB.map((step, i) => {
              const state = i < 4 ? 'done' : i === 4 ? 'miss' : '';
              return (
                <li key={step.q} className={`step ${state}`}>
                  <span className="n num">{i + 1}</span>
                  <div>
                    <p className="rl">{RUNGS[i]}</p>
                    <p className="qq">{step.q}</p>
                    <p className="ans">
                      {step.a === null ? (
                        <span className="t3">Not reached</span>
                      ) : state === 'miss' ? (
                        <span className="tmiss">{step.a}</span>
                      ) : (
                        step.a
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2 className="h1">Pick who&apos;s pimping</h2>
          <p className="body t2 mt12 measure">
            Three attendings, the same scripts and the same grading. Only the pace and the tone
            change.
          </p>
          <div className="cols mt40">
            {PERSONAS.map((p) => (
              <div key={p.name} className="stack">
                <h3 className="h2">{p.name}</h3>
                <p className="body t2">{p.how}</p>
                <p className="small">{p.pace}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap split">
          <div className="stack-lg">
            <h2 className="h1">Lists get partial credit</h2>
            <p className="body t2 measure">
              &ldquo;Name three more&rdquo; counts each one you know. The ones you didn&apos;t say
              show up as gaps, not errors, so you know exactly which to learn.
            </p>
          </div>
          <div className="panel">
            <p className="meta">Acute pancreatitis, rung 2</p>
            <p className="q mt8">Gallstones and alcohol are the top two causes. Name three more.</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 20 }}>
              <span className="num" style={{ fontSize: 56, lineHeight: 1, color: 'var(--signal)' }}>
                2
              </span>
              <span className="num t3" style={{ fontSize: 28 }}>
                / 3
              </span>
              <span className="meta" style={{ marginLeft: 8 }}>
                Partial credit
              </span>
            </div>
            <ul
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                marginTop: 18,
                listStyle: 'none',
              }}
            >
              {['Hypertriglyceridemia', 'Post-ERCP'].map((a) => (
                <li key={a} className="answer got">
                  <Check aria-label="Got it" />
                  {a}
                </li>
              ))}
              {['Medications', 'Hypercalcemia'].map((a) => (
                <li key={a} className="answer missed">
                  <Minus aria-label="Missed" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap split">
          <div className="panel">
            <div style={{ display: 'flex', gap: 22, alignItems: 'flex-end' }}>
              <Ladder states={['done', 'done', 'done', 'done', 'miss', '']} width={150} />
              <div style={{ paddingBottom: 4 }}>
                <p className="num" style={{ fontSize: 88, lineHeight: 0.9 }}>
                  4
                </p>
                <p className="meta mt8">rungs climbed</p>
              </div>
            </div>
            <div
              className="mt26"
              style={{ background: 'var(--bg)', borderRadius: 18, padding: 16 }}
            >
              <p className="small">Pimped on management</p>
              <p style={{ marginTop: 6, fontSize: 15, lineHeight: '21px' }}>
                You said{' '}
                <span className="tmiss">&ldquo;Keep them NPO until the pain resolves.&rdquo;</span>{' '}
                The script says early oral feeding as tolerated.
              </p>
              <p className="link mt8">Review the script</p>
            </div>
          </div>
          <div className="stack-lg first-on-phone">
            <h2 className="h1">Where you got pimped</h2>
            <p className="body t2 measure">
              The result names the rung you missed, quotes what you said, and puts what the script
              says next to it. One card, with a link to the full script. A clean run gets no card at
              all.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap split">
          <div className="stack-lg">
            <h2 className="h1">Review, and the mix-ups</h2>
            <p className="body t2 measure">
              Each evening, Review lists today&apos;s misses with their scripts. When you keep
              confusing two diagnoses, PimpMe puts them side by side and drills the pair until they
              come apart.
            </p>
          </div>
          <div>
            <h3 className="h3">Missed today</h3>
            <div className="list mt12">
              <div className="lrow">
                <span className="mark" />
                <div className="grow">
                  <p style={{ fontWeight: 500 }}>Acute pancreatitis</p>
                  <p className="small">Pimped on management</p>
                </div>
                <ChevronRight aria-hidden="true" />
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                margin: '26px 0 10px',
              }}
            >
              <h3 className="h3">You keep mixing these up</h3>
              <span className="small">3 times this week</span>
            </div>
            <div className="compare">
              {[
                ['Nephritic', 'Hematuria, RBC casts', 'Under 3.5 g/day', 'Post-strep GN'],
                ['Nephrotic', 'Fatty casts', 'Over 3.5 g/day', 'Minimal change'],
              ].map(([name, urine, protein, classic]) => (
                <div key={name}>
                  <p className="h2" style={{ fontSize: 19 }}>
                    {name}
                  </p>
                  <p className="k">Urine</p>
                  <p className="v">{urine}</p>
                  <p className="k">Protein</p>
                  <p className="v">{protein}</p>
                  <p className="k">Classic</p>
                  <p className="v">{classic}</p>
                </div>
              ))}
            </div>
            <span
              className="btn btn-quiet btn-block mt12"
              style={{ height: 46, fontSize: 15 }}
              aria-hidden="true"
            >
              Drill this pair
            </span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2 className="h1">Progress that rewards the work</h2>
          <p className="body t2 mt12 measure">
            Everything runs on the rungs you already climb. There&apos;s no separate points system,
            and nothing nags you about a day off.
          </p>
          <div className="cols grid2 mt40">
            <div className="stack">
              <h3 className="h3">Today&apos;s rounds</h3>
              <div className="segs mt12" style={{ maxWidth: 280 }} aria-hidden="true">
                <i className="on" />
                <i className="on" />
                <i />
              </div>
              <p className="small">2 of 3</p>
              <p className="body t2">
                Three short sessions finish rounds for the day. Set your own goal from one to five.
              </p>
            </div>
            <div className="stack">
              <h3 className="h3">Shifts</h3>
              <div className="cal mt12" style={{ maxWidth: 340 }} aria-hidden="true">
                {SHIFTS.map((c, i) => (
                  <i key={i} className={c} />
                ))}
              </div>
              <p className="body t2">
                A day with rounds finished counts as a shift. One post-call day a week is applied
                for you. Miss a day and the count quietly starts again.
              </p>
            </div>
            <div className="stack">
              <h3 className="h3">Rank</h3>
              <div className="track mt12" style={{ maxWidth: 340 }} aria-hidden="true">
                {RANKS.map((r, i) => (
                  <i
                    key={r}
                    className={i < 2 ? 'on' : i === 2 ? 'here' : undefined}
                    style={{ height: 12 + i * 8 }}
                  />
                ))}
              </div>
              <div className="trackl" style={{ maxWidth: 340 }}>
                {RANKS.map((r, i) => (
                  <span key={r} className={i === 2 ? 'here' : undefined}>
                    {r}
                  </span>
                ))}
              </div>
              <p className="body t2">
                Six titles earned by total rungs climbed, from MS3 to Attending. Rank never goes
                down.
              </p>
            </div>
            <div className="stack">
              <h3 className="h3">Mastery</h3>
              <div className="tiles mt12" style={{ maxWidth: 340 }} aria-hidden="true">
                <div className="tile mastered">
                  <p>Diabetic ketoacidosis</p>
                  <div className="mini mastered">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <i key={i} />
                    ))}
                  </div>
                </div>
                <div className="tile due">
                  <p>Hyponatremia</p>
                  <div className="mini">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <i key={i} className={i < 4 ? 'on' : undefined} />
                    ))}
                  </div>
                </div>
              </div>
              <p className="body t2">
                Reach rung 6 on two different days to master a script. Thirty days later it asks for
                a re-check.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap center stack-lg">
          <h2 className="h1">Ready to get pimped?</h2>
          <p className="body t2">It takes about five minutes.</p>
          <GetStarted beta={false} note={false} />
        </div>
      </section>
    </>
  );
}
