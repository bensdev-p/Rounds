'use client';
import { EmailSchema, sendSignInCode, verifyEmailCode, WrongCodeError } from '@rounds/shared/api';
import type { RoundsClient } from '@rounds/shared/api';
import { TriangleAlert } from 'lucide-react';
import { type FormEvent, useState } from 'react';

/**
 * Sign in with a 6-digit email code, on the same project as the app (not
 * drawn; built from the site's form pieces). Existing accounts only: testers
 * sign up in the app first, so this never creates an account.
 */
export function TesterSignIn({
  client,
  title,
  note,
  onSignedIn,
}: {
  client: RoundsClient;
  title: string;
  note: string;
  onSignedIn: () => void;
}) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: FormEvent) {
    e.preventDefault();
    const address = email.trim();
    if (!EmailSchema.safeParse(address).success) {
      setError('Enter the email you use in PimpMe.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendSignInCode(client, address);
      setSentTo(address);
      setCode('');
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(
        /signups? not allowed|not found|user/i.test(message)
          ? 'No PimpMe account uses that email. Testers sign up in the app first.'
          : /rate|seconds|too many/i.test(message)
            ? 'Too many codes for now. Wait a minute and try again.'
            : 'The code didn’t send. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!sentTo || code.replace(/\s/g, '').length < 6) return;
    setBusy(true);
    setError(null);
    try {
      await verifyEmailCode(client, sentTo, code, 'sign_in');
      onSignedIn();
    } catch (err) {
      setError(
        err instanceof WrongCodeError
          ? 'That code didn’t work. Check it, or send a new one.'
          : 'Couldn’t sign in. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={sentTo ? verify : send} aria-labelledby="signin-title">
      <h2 className="h2" id="signin-title">
        {title}
      </h2>
      <p className="small mt8">{note}</p>
      {sentTo ? (
        <>
          <label className="label mt20" htmlFor="signin-code">
            The 6-digit code we sent to {sentTo}
          </label>
          <input
            id="signin-code"
            className="field on-surface num"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'signin-error' : undefined}
          />
        </>
      ) : (
        <>
          <label className="label mt20" htmlFor="signin-email">
            Email
          </label>
          <input
            id="signin-email"
            className="field on-surface"
            type="email"
            autoComplete="email"
            placeholder="you@school.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'signin-error' : undefined}
          />
        </>
      )}
      {error ? (
        <p className="warn mt8" id="signin-error" role="alert">
          <TriangleAlert aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary btn-block mt20" disabled={busy}>
        {busy ? 'One moment…' : sentTo ? 'Sign in' : 'Send code'}
      </button>
      {sentTo ? (
        <button
          type="button"
          className="btn btn-quiet btn-block mt12"
          disabled={busy}
          onClick={() => {
            setSentTo(null);
            setError(null);
          }}
        >
          Use a different email
        </button>
      ) : null}
    </form>
  );
}
