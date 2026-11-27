'use client';

import { detectPhi, phiWarning } from '@rounds/shared';
import { TriangleAlert } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { site } from '../../lib/site.ts';

/**
 * Send feedback (Support page). The site is static, so sending opens the visitor's
 * email app with the message filled in, addressed to support@pimpme.app. The PHI
 * guard blocks patient details first, as everywhere else (domain rule 5).
 */
export function FeedbackForm() {
  const [what, setWhat] = useState('');
  const [email, setEmail] = useState('');
  const warning = phiWarning(detectPhi(what));

  const send = (e: FormEvent) => {
    e.preventDefault();
    if (warning || !what.trim()) return;
    const body = email.trim() ? `${what.trim()}\n\nReply to: ${email.trim()}` : what.trim();
    const params = new URLSearchParams({ subject: 'PimpMe feedback', body });
    window.location.href = `mailto:${site.supportEmail}?${params.toString().replace(/\+/g, '%20')}`;
  };

  return (
    <form className="panel" id="feedback" onSubmit={send} aria-labelledby="feedback-title">
      <h2 className="h2" id="feedback-title">
        Testing the beta? Send feedback
      </h2>
      <p className="small mt8">Goes straight to the developer. Never include patient details.</p>
      <label className="label mt20" htmlFor="fb-what">
        What happened?
      </label>
      <textarea
        id="fb-what"
        className={`field area on-surface${warning ? ' error' : ''}`}
        value={what}
        onChange={(e) => setWhat(e.target.value)}
        aria-invalid={warning ? true : undefined}
        aria-describedby={warning ? 'fb-warn' : undefined}
        maxLength={4000}
      />
      {warning ? (
        <p className="warn mt8" id="fb-warn" role="alert">
          <TriangleAlert aria-hidden="true" />
          <span>{warning}</span>
        </p>
      ) : null}
      <label className="label mt16" htmlFor="fb-email">
        Email, if you&apos;d like a reply
      </label>
      <input
        id="fb-email"
        className="field on-surface"
        type="email"
        autoComplete="email"
        placeholder="you@school.edu"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button
        type="submit"
        className="btn btn-primary btn-block mt20"
        disabled={!!warning || !what.trim()}
      >
        Send feedback
      </button>
      <p className="small mt12">This opens your email app with the message ready to send.</p>
    </form>
  );
}
