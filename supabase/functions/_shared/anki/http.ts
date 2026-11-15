/**
 * Shared pieces of the Anki bridge functions (M3.3): responses, hashing and
 * clients. The add-on never holds a Supabase key: it sends the pairing code,
 * then its device token in `x-rounds-device`. These functions run with the
 * gateway's JWT check off (supabase/config.toml) and check callers themselves.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@rounds/shared';

function env(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

const url = env('SUPABASE_URL');
const anonKey = env('SUPABASE_ANON_KEY');

export const admin: SupabaseClient<Database> = createClient<Database>(
  url,
  env('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-rounds-device',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** Bodies above this are refused before parsing (5,000 cards is about 1 MB). */
export const MAX_BODY_BYTES = 2_000_000;

/** The JSON body, or null when it's missing, too big or not JSON. */
export async function readBody(request: Request): Promise<unknown | null> {
  const text = await request.text().catch(() => null);
  if (text === null || text.length > MAX_BODY_BYTES) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** 32 random bytes as hex: the add-on's device token. */
export function newDeviceToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

/** The signed-in student calling from the app (anonymous students count), or null. */
export async function callerId(request: Request): Promise<string | null> {
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await asCaller.auth.getUser();
  return error || !data.user ? null : data.user.id;
}

/** The caller's address, hashed, for the wrong-code limit. Never stored in the clear. */
export async function callerIpHash(request: Request): Promise<string> {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return sha256(`anki-claim:${forwarded || request.headers.get('x-real-ip') || 'unknown'}`);
}

export function log(fields: Record<string, unknown>): void {
  console.log(JSON.stringify(fields));
}
