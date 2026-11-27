import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDoc, type LegalSection } from '../../components/LegalDoc.tsx';
import { site } from '../../lib/site.ts';

export const metadata: Metadata = { title: 'Terms' };

/*
 * DRAFT (M4.3). Not legal advice. The developer is to have it reviewed before the
 * tester release (ROADMAP → M4.6).
 */
const sections: LegalSection[] = [
  {
    id: 'using-pimpme',
    title: 'Using PimpMe',
    body: (
      <>
        <p>
          PimpMe is a practice tool for medical students, run by Benjamin Brunson in Texas, United
          States. It asks questions from illness scripts and grades your answers. These terms cover
          the app, the web app, the Anki add-on and this website. By using PimpMe you agree to them.
        </p>
        <p>You must be 18 or older to use PimpMe.</p>
      </>
    ),
  },
  {
    id: 'educational-use-only',
    title: 'Educational use only',
    body: (
      <p>
        PimpMe is for education. It is not clinical guidance and must not be used to make decisions
        about a patient&apos;s care. Scripts are written and reviewed with care, but they can
        contain mistakes or fall out of date. Always follow your team, your institution&apos;s
        protocols and current guidelines.
      </p>
    ),
  },
  {
    id: 'your-account',
    title: 'Your account',
    body: (
      <p>
        Keep access to your email or Apple ID secure: anyone who can sign in as you can see your
        practice. Practice you do before signing in is kept on an anonymous account and moves to
        your account when you sign in on the same device. You can delete your account at any time in
        Profile → Settings → Account.
      </p>
    ),
  },
  {
    id: 'patient-details',
    title: 'Patient details',
    body: (
      <p>
        You agree never to enter information that could identify a patient: names, dates of birth,
        record numbers, phone numbers, addresses or anything like them. PimpMe blocks what it can
        recognise, but keeping patient details out is your responsibility. See the{' '}
        <Link href="/privacy">privacy policy</Link>.
      </p>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <p>
        Don&apos;t try to break, overload or get around PimpMe&apos;s limits, access other
        people&apos;s data, or copy the scripts and questions in bulk.
      </p>
    ),
  },
  {
    id: 'content-and-licences',
    title: 'Content and licences',
    body: (
      <>
        <p>
          The illness scripts, questions and the PimpMe name and design belong to PimpMe. You may
          use them for your own study.
        </p>
        <p>
          PimpMe never stores or shows AnKing card text or question bank content. The Anki add-on
          works with card ids only. Anki, AnKing and AnkiHub are separate projects, not connected
          with PimpMe.
        </p>
      </>
    ),
  },
  {
    id: 'beta-software',
    title: 'Beta software',
    body: (
      <p>
        PimpMe is in testing. Features may change or stop working, and practice data could be lost.
        It is provided free of charge, as it is, without warranties of any kind.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Liability',
    body: (
      <p>
        As far as the law allows, PimpMe is not liable for any indirect or consequential loss, or
        for any decision made using it. Nothing in these terms limits rights you have by law that
        can&apos;t be limited.
      </p>
    ),
  },
  {
    id: 'ending-use',
    title: 'Ending use',
    body: (
      <p>
        You can stop using PimpMe and delete your account at any time. We may suspend or close an
        account that breaks these terms, or end the service, and will try to give notice first.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes',
    body: (
      <p>
        If these terms change, we&apos;ll update the date at the top. If a change matters,
        we&apos;ll tell you in the app or by email first. Using PimpMe after a change means you
        accept it.
      </p>
    ),
  },
  {
    id: 'law',
    title: 'Law',
    body: <p>These terms are governed by the laws of the State of Texas, United States.</p>,
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>
      </p>
    ),
  },
];

export default function Terms() {
  return (
    <LegalDoc
      title="Terms"
      updated="25 November 2026"
      note={
        <>
          <b>Draft.</b> PimpMe is in testing, and these terms will be reviewed before it opens to
          more students.
        </>
      }
      sections={sections}
    />
  );
}
