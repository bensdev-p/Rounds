import { ChevronRight, CircleHelp, Flag, Mail, Smartphone } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { site } from '../../lib/site.ts';
import { FeedbackForm } from './FeedbackForm.tsx';

export const metadata: Metadata = { title: 'Support' };

export default function Support() {
  return (
    <section className="section">
      <div className="wrap split top-align">
        <div className="stack-lg">
          <h1 className="t-page">Support</h1>
          <p className="lede measure">Something broken, confusing or wrong? Tell us.</p>
          <div className="list mt12">
            <a className="lrow" href={`mailto:${site.supportEmail}`}>
              <Mail aria-hidden="true" />
              <div className="grow">
                <p className="w500">Email</p>
                <p className="small">{site.supportEmail}</p>
              </div>
              <ChevronRight aria-hidden="true" />
            </a>
            <div className="lrow">
              <Smartphone aria-hidden="true" />
              <div className="grow">
                <p className="w500">In the app</p>
                <p className="small">Profile → Settings → Send feedback</p>
              </div>
            </div>
            <div className="lrow">
              <Flag aria-hidden="true" />
              <div className="grow">
                <p className="w500">A question looks wrong</p>
                <p className="small">
                  Use &ldquo;Something wrong with a question?&rdquo; on the result screen
                </p>
              </div>
            </div>
            <Link className="lrow" href="/faq">
              <CircleHelp aria-hidden="true" />
              <div className="grow">
                <p className="w500">Read the FAQ</p>
                <p className="small">Voice, Anki, patient details and more</p>
              </div>
              <ChevronRight aria-hidden="true" />
            </Link>
          </div>
          <p className="small measure">
            Want to try PimpMe? It&apos;s in testing with a small group of medical students. Email{' '}
            <a
              className="link"
              style={{ fontSize: 13 }}
              href={`mailto:${site.supportEmail}?subject=PimpMe%20invite`}
            >
              {site.supportEmail}
            </a>{' '}
            and ask for an invite to the web app or the iPhone beta.
          </p>
        </div>
        <FeedbackForm />
      </div>
    </section>
  );
}
