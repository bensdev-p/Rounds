import { ChevronDown } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: 'Questions' };

/**
 * The first answer is the mockup's. The rest were drafted from PRODUCT.md and the
 * domain rules for the developer's review (M4.3).
 */
const FAQ: { q: string; a: ReactNode[] }[] = [
  {
    q: 'Why is it called PimpMe?',
    a: [
      'Because that’s what it’s called on the wards. “Pimping” is medicine’s word for an attending firing hard questions at a student, and it’s been around since at least the 1980s. PimpMe takes your side: you ask for it, you practise in private, and you walk onto rounds ready.',
    ],
  },
  {
    q: 'Is this pimping as mistreatment?',
    a: [
      'No. Pimping goes wrong when it’s used to humiliate someone in front of the team. PimpMe keeps the useful part, hard questions that get harder, and drops the audience. You choose when to start, nobody else sees your answers, and a miss just shows you what to read tonight.',
      'If you’re being mistreated on a rotation, that’s worth raising with your clerkship director or your school’s mistreatment reporting process.',
    ],
  },
  {
    q: 'Is PimpMe clinical guidance?',
    a: [
      'No. PimpMe is for education only. Don’t use it to make decisions about a real patient’s care. Follow your team, your hospital’s protocols and current guidelines.',
    ],
  },
  {
    q: 'Where do the questions come from?',
    a: [
      'Every question and accepted answer comes from an illness script: a structured summary of one diagnosis, written for PimpMe and reviewed by a physician before anyone is asked from it. The AI attending asks the questions and grades your answer against the script. It doesn’t make up medical facts.',
    ],
  },
  {
    q: 'Do I have to answer out loud?',
    a: [
      'No, but you should. Knowing the answer and saying it with someone waiting are different skills, and rounds tests the second one. In the library or on the shuttle? Switch to typing in any session.',
    ],
  },
  {
    q: 'Can I put patient details in?',
    a: [
      'No, and PimpMe will stop you. The log keeps a diagnosis, a rotation and a date, nothing else. Anything that looks like a name, a date of birth, a record number, a phone number or an address is blocked before it’s saved.',
    ],
  },
  {
    q: 'Does the Anki add-on read my cards?',
    a: [
      'No. It works with card and note ids only. It never reads or uploads card text, card fronts or note fields.',
      <>
        For each linked card it sends review numbers: due date, interval and lapses.{' '}
        <Link href="/anki">How the add-on works</Link>
      </>,
    ],
  },
  {
    q: 'What happens if I miss a day?',
    a: [
      'Nothing. You were post-call, we know. One day off a week is applied for you, and if you miss more, your count of shifts quietly starts again. Your rank never goes down. Nobody gets a guilt notification.',
    ],
  },
  {
    q: 'Which rotations are covered?',
    a: [
      'Medicine first, because that’s where the pimping is heaviest. Some scripts also cover emergency medicine, surgery, pediatrics, family medicine, neurology and psychiatry, and more are coming.',
    ],
  },
  {
    q: 'Is there an Android app?',
    a: [
      'Not yet. The iPhone app came first, sorry. On Android you’ll be able to use PimpMe in the browser.',
    ],
  },
  {
    q: 'Can I use it on my computer?',
    a: [
      'Yes, in the web app, which is in testing now. Same attendings, bigger screen. The Anki add-on runs in Anki on Windows, macOS and Linux.',
    ],
  },
];

export default function Faq() {
  return (
    <section className="section">
      <div className="wrap split top-align wide-right">
        <div className="stack-lg">
          <h1 className="t-page">Questions</h1>
          <p className="body t2 measure">
            The short answers, no lecture. Still stuck?{' '}
            <Link className="link" href="/support">
              Contact support
            </Link>
          </p>
        </div>
        <div className="faq">
          {FAQ.map((item, i) => (
            <details key={item.q} open={i === 0}>
              <summary>
                <span>{item.q}</span>
                <ChevronDown aria-hidden="true" />
              </summary>
              {item.a.map((p, j) => (
                <p key={j} className="qa">
                  {p}
                </p>
              ))}
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
