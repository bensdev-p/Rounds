/**
 * POST /functions/v1/delete-account
 *
 * Deletes the calling student's account (App Store rule 5.1.1(v)). Every
 * table references auth.users with `on delete cascade`, so their sessions,
 * attempts, logs, flags and profile go with it. Only the caller can be
 * deleted: the user id comes from their own token, never from the request.
 *
 * Env (set by Supabase): SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js';

function env(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

const url = env('SUPABASE_URL');
const anonKey = env('SUPABASE_ANON_KEY');
const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json(405, { error: 'POST only' });

  const authorization = request.headers.get('Authorization') ?? '';
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await asCaller.auth.getUser();
  if (error || !data.user) return json(401, { error: 'Not signed in' });

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const deleted = await admin.auth.admin.deleteUser(data.user.id);
  if (deleted.error) {
    console.error(JSON.stringify({ event: 'delete-account', error: deleted.error.message }));
    return json(500, { error: 'Could not delete the account' });
  }
  console.log(JSON.stringify({ event: 'delete-account', ok: true }));
  return json(200, { deleted: true });
});
