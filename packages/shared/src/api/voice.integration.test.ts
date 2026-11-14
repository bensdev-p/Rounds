/**
 * The voice functions (`speech-token`, `speak`) against the local stack, with
 * the fake speech providers (spend nothing). Requires `pnpm db:start` and
 * `pnpm functions:serve:fake`.
 */
import { createClient } from '@supabase/supabase-js';
import { describe, expect, inject, it } from 'vitest';
import type { Database } from '../db/database.types.ts';
import { fetchSpeech, getSpeechToken, type RoundsClient } from './index.ts';

async function newStudent(): Promise<RoundsClient> {
  const client = createClient<Database>(inject('supabaseUrl'), inject('supabaseKey'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInAnonymously();
  if (error) throw error;
  return client;
}

const functionsUrl = () => `${inject('supabaseUrl')}/functions/v1`;
const RECALL = 'zorblax-syndrome.recall.1';

describe('speech-token function (fake)', () => {
  it('gives a signed-in student a short-lived token', async () => {
    const token = await getSpeechToken(await newStudent());
    expect(token).toMatchObject({ vendor: 'fake', model: 'fake' });
    expect(token.expires_in).toBeGreaterThan(0);
  });

  it('refuses a caller with no session', async () => {
    const response = await fetch(`${functionsUrl()}/speech-token`, {
      method: 'POST',
      headers: { apikey: inject('supabaseKey') },
    });
    expect(response.ok).toBe(false);
  });
});

describe('speak function (fake)', () => {
  it('voices a question, then serves the same audio from the cache', async () => {
    const client = await newStudent();
    // A speed nobody else uses in tests, so the first ask is a cache miss on a fresh stack.
    const request = { question_id: RECALL, persona: 'surgeon', speed: 1.4 } as const;
    const first = await fetchSpeech(client, functionsUrl(), inject('supabaseKey'), request);
    expect(first.headers.get('x-audio-format')).toBe('pcm_s16le;rate=24000;channels=1');
    const firstBytes = new Uint8Array(await first.arrayBuffer());
    expect(firstBytes.length).toBeGreaterThan(1_000);
    expect(firstBytes.length % 2).toBe(0);

    // The copy is saved after the response; give it a moment.
    let second: Response | null = null;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 150));
      second = await fetchSpeech(client, functionsUrl(), inject('supabaseKey'), request);
      if (second.headers.get('x-cache') === 'hit') break;
      await second.arrayBuffer();
    }
    expect(second?.headers.get('x-cache')).toBe('hit');
    expect(new Uint8Array(await second!.arrayBuffer())).toEqual(firstBytes);
  });

  it('voices the thinking cue', async () => {
    const response = await fetchSpeech(await newStudent(), functionsUrl(), inject('supabaseKey'), {
      cue: 'thinking',
      persona: 'teacher',
      speed: 1,
    });
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it('refuses a question the student cannot see', async () => {
    await expect(
      fetchSpeech(await newStudent(), functionsUrl(), inject('supabaseKey'), {
        question_id: 'no-such-script.recall.1',
        persona: 'teacher',
        speed: 1,
      }),
    ).rejects.toThrow(/404/);
  });

  it('never speaks free text or an unknown speed', async () => {
    const client = await newStudent();
    const { data } = await client.auth.getSession();
    const headers = {
      Authorization: `Bearer ${data.session!.access_token}`,
      apikey: inject('supabaseKey'),
    };
    const text = await fetch(`${functionsUrl()}/speak?text=hello&persona=teacher`, { headers });
    expect(text.status).toBe(400);
    const speed = await fetch(`${functionsUrl()}/speak?cue=thinking&persona=teacher&speed=3`, {
      headers,
    });
    expect(speed.status).toBe(400);
  });

  it('refuses a caller with no session', async () => {
    const response = await fetch(`${functionsUrl()}/speak?cue=thinking&persona=teacher`, {
      headers: { apikey: inject('supabaseKey') },
    });
    expect(response.ok).toBe(false);
  });
});
