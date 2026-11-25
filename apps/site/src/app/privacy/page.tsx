import type { Metadata } from 'next';
import { LegalDoc, type LegalSection } from '../../components/LegalDoc.tsx';
import { site } from '../../lib/site.ts';

export const metadata: Metadata = { title: 'Privacy policy' };

/*
 * DRAFT (M4.3), written from what the code does on 25 Nov 2026. Not legal advice.
 * The developer is to have it reviewed before the tester release (ROADMAP → M4.6).
 */
const sections: LegalSection[] = [
  {
    id: 'who-we-are',
    title: 'Who we are',
    body: (
      <p>
        PimpMe is a practice tool for medical students, run by Benjamin Brunson in Texas, United
        States. In this policy, &ldquo;PimpMe&rdquo;, &ldquo;we&rdquo; and &ldquo;us&rdquo; mean
        him. It covers the PimpMe app, the web app, the Anki add-on and this website.
      </p>
    ),
  },
  {
    id: 'what-we-collect',
    title: 'What we collect',
    body: (
      <ul>
        <li>
          <b>Account details:</b> an email address, or your Apple ID if you use Sign in with Apple.
          Before you sign in, your practice is kept under an anonymous account id on your device.
        </li>
        <li>
          <b>Your practice:</b> sessions, the scripts you were asked about, the rungs you reached,
          the answers you gave (as text) and how they were graded, your settings, and your progress.
        </li>
        <li>
          <b>Your log:</b> patients you log, by diagnosis label, rotation and date only.
        </li>
        <li>
          <b>Reports you send:</b> &ldquo;This is wrong&rdquo; flags on questions, and any feedback
          or email you send to support.
        </li>
      </ul>
    ),
  },
  {
    id: 'what-we-never-collect',
    title: 'What we never collect',
    body: (
      <p>
        Patient details of any kind. The log stores a diagnosis label, a rotation and a date.
        Free-text fields block anything that looks like a name, a date of birth, a record number, a
        phone number or an address before it is saved. Please never type patient details into
        PimpMe.
      </p>
    ),
  },
  {
    id: 'anki-data',
    title: 'Anki data',
    body: (
      <p>
        If you connect the add-on, it sends card and note ids for the cards linked to PimpMe
        scripts, with their review numbers: due date, interval and lapses. It also receives the
        unsuspend and tag actions you asked for. It never reads or uploads card text, card fronts or
        note fields, and it doesn&apos;t touch cards you haven&apos;t missed on.
      </p>
    ),
  },
  {
    id: 'voice-recordings',
    title: 'Voice recordings',
    body: (
      <>
        <p>
          When you answer out loud, your voice is streamed from your device to our speech provider,
          Deepgram, which turns it into text while you speak. The attending&apos;s voice is also
          made by Deepgram from the question text.
        </p>
        <p>
          We keep the text of your answer, not the audio. Deepgram handles audio under its own
          terms. If you&apos;d rather not use your voice, type your answers instead: text works
          everywhere.
        </p>
      </>
    ),
  },
  {
    id: 'how-we-use-it',
    title: 'How we use it',
    body: (
      <ul>
        <li>To run sessions, and to grade your answers against the illness scripts.</li>
        <li>To build your review, your progress and your rank.</li>
        <li>To unsuspend and tag your Anki cards, if you connected the add-on.</li>
        <li>To send sign-in codes.</li>
        <li>To fix problems, correct scripts you flag, and see how PimpMe is used overall.</li>
      </ul>
    ),
  },
  {
    id: 'who-we-share-it-with',
    title: 'Who we share it with',
    body: (
      <>
        <p>
          We don&apos;t sell your data, and there are no ads. We use these services to run PimpMe:
        </p>
        <ul>
          <li>Supabase: database, sign-in and the server functions.</li>
          <li>
            Anthropic: grading. Your answer and the matching part of the script are sent to the
            Claude API.
          </li>
          <li>Deepgram: speech to text, and the attending&apos;s voice.</li>
          <li>Resend: sends sign-in code emails.</li>
          <li>Cloudflare: hosts this website and forwards email sent to {site.supportEmail}.</li>
          <li>Apple: Sign in with Apple, and TestFlight for the iPhone beta.</li>
        </ul>
        <p>
          They process data only to provide their service to us. We may also disclose data if the
          law requires it.
        </p>
      </>
    ),
  },
  {
    id: 'this-website',
    title: 'This website',
    body: (
      <p>
        This website doesn&apos;t use cookies, analytics or trackers. Cloudflare, which serves it,
        may keep standard logs such as IP addresses for security. The feedback form opens your own
        email app; nothing is sent until you send that email.
      </p>
    ),
  },
  {
    id: 'keeping-and-deleting',
    title: 'Keeping and deleting',
    body: (
      <p>
        We keep your data while you have an account. You can delete your account at any time in
        Profile → Settings → Account. That deletes your account and everything linked to it:
        sessions, answers, log, progress and Anki data. Copies in our providers&apos; backups expire
        on their own schedule.
      </p>
    ),
  },
  {
    id: 'your-choices',
    title: 'Your choices',
    body: (
      <ul>
        <li>Type instead of speaking.</li>
        <li>Leave Anki unconnected, or disconnect it from either side.</li>
        <li>Delete your account in the app.</li>
        <li>Email us to ask for a copy of your data, or to correct or delete it.</li>
      </ul>
    ),
  },
  {
    id: 'age',
    title: 'Age',
    body: (
      <p>
        PimpMe is for people aged 18 and over. We don&apos;t knowingly collect data from anyone
        younger.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes',
    body: (
      <p>
        If this policy changes, we&apos;ll update the date at the top. If a change matters,
        we&apos;ll tell you in the app or by email first.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        Questions about your data: <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.
      </p>
    ),
  },
];

export default function Privacy() {
  return (
    <LegalDoc
      title="Privacy policy"
      updated="25 November 2026"
      note={
        <>
          <b>Draft.</b> PimpMe is in testing, and this policy will be reviewed before it opens to
          more students.
        </>
      }
      sections={sections}
    />
  );
}
