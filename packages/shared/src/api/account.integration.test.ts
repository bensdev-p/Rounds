/**
 * Accounts against the local stack: an anonymous student adds an email and
 * keeps their history; a second device signs in to the same account; the
 * profile is saved and read back; deleting the account removes everything.
 * Codes are read from Mailpit, which catches the local stack's emails.
 * Requires `pnpm db:start` and `pnpm functions:serve:fake` (for delete-account).
 */
import { createClient } from '@supabase/supabase-js';
import { describe, expect, inject, it } from 'vitest';
import type { Database } from '../db/database.types.ts';
import { newProfile } from '../profile/profile.ts';
import {
  deleteAccount,
  getProfile,
  logPatient,
  listLogsSince,
  saveProfile,
  sendAddEmailCode,
  sendSignInCode,
  verifyEmailCode,
  WrongCodeError,
  type RoundsClient,
} from './index.ts';

function newClient(): RoundsClient {
  return createClient<Database>(inject('supabaseUrl'), inject('supabaseKey'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function newStudent(): Promise<RoundsClient> {
  const client = newClient();
  const { error } = await client.auth.signInAnonymously();
  if (error) throw error;
  return client;
}

async function userId(client: RoundsClient): Promise<string> {
  const { data } = await client.auth.getUser();
  if (!data.user) throw new Error('not signed in');
  return data.user.id;
}

interface MailpitList {
  messages: { ID: string; Created: string }[];
}

/** The newest 6-digit code sent to `email` after `since`. */
async function codeFor(email: string, since: number): Promise<string> {
  const base = inject('mailpitUrl');
  for (let tries = 0; tries < 30; tries++) {
    const list = (await (
      await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)
    ).json()) as MailpitList;
    const fresh = list.messages.find((m) => Date.parse(m.Created) >= since - 1000);
    if (fresh) {
      const message = (await (await fetch(`${base}/api/v1/message/${fresh.ID}`)).json()) as {
        Text: string;
      };
      const code = /\b(\d{6})\b/.exec(message.Text)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`No code arrived for ${email}`);
}

const uniqueEmail = () => `student-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`;

describe('accounts', () => {
  it('adds an email to an anonymous student and keeps their history', async () => {
    const phone = await newStudent();
    const before = await userId(phone);
    await logPatient(phone, { label: 'Zorblax syndrome', script_id: null, rotation: 'IM' });
    await saveProfile(phone, newProfile({ year: 'MS3', rotation: 'IM', daily_goal: 4 }));

    const email = uniqueEmail();
    const sent = Date.now();
    expect(await sendAddEmailCode(phone, email)).toBe('sent');
    await expect(verifyEmailCode(phone, email, '000000', 'add_email')).rejects.toBeInstanceOf(
      WrongCodeError,
    );
    await verifyEmailCode(phone, email, await codeFor(email, sent), 'add_email');

    const { data } = await phone.auth.getUser();
    expect(data.user?.id).toBe(before);
    expect(data.user?.is_anonymous).toBe(false);
    expect(data.user?.email).toBe(email);
    expect(await listLogsSince(phone, '2000-01-01T00:00:00Z')).toHaveLength(1);

    // A second device: the email already has an account, so it's a sign-in.
    const laptop = await newStudent();
    expect(await sendAddEmailCode(laptop, email)).toBe('exists');
    const sent2 = Date.now();
    await sendSignInCode(laptop, email);
    await verifyEmailCode(laptop, email, await codeFor(email, sent2), 'sign_in');
    expect(await userId(laptop)).toBe(before);
    expect((await getProfile(laptop))?.daily_goal).toBe(4);
    expect(await listLogsSince(laptop, '2000-01-01T00:00:00Z')).toHaveLength(1);
  });

  it('never creates an account from a sign-in code', async () => {
    const student = await newStudent();
    await expect(sendSignInCode(student, uniqueEmail())).rejects.toThrow();
  });

  it('saves and reads back the profile; none before onboarding', async () => {
    const student = await newStudent();
    expect(await getProfile(student)).toBeNull();
    const profile = newProfile({
      year: 'MS4',
      rotation: 'surgery',
      rotation_started_on: '2026-11-02',
      rotation_weeks: 6,
    });
    await saveProfile(student, profile);
    expect(await getProfile(student)).toEqual(profile);
    await saveProfile(student, { ...profile, answer_timeout: 'off', persona: 'surgeon' });
    expect(await getProfile(student)).toMatchObject({ answer_timeout: 'off', persona: 'surgeon' });
  });

  it('deletes the account and everything in it', async () => {
    const student = await newStudent();
    await saveProfile(student, newProfile({ year: 'MS3', rotation: 'IM' }));
    await deleteAccount(student);
    // The old token no longer belongs to a user.
    const { data } = await student.auth.getUser();
    expect(data.user).toBeNull();
  });
});
