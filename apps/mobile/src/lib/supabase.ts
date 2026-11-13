import type { Database } from '@rounds/shared';
import type { RoundsClient } from '@rounds/shared/api';
import { createClient } from '@supabase/supabase-js';
import { authStorage } from './authStorage';

let client: RoundsClient | null = null;

export class ConfigError extends Error {
  override name = 'ConfigError';
}

/**
 * The app's Supabase client, created on first use from public env vars (see
 * .env.example). Only the publishable key ships to the client; RLS does the rest.
 */
export function getSupabase(): RoundsClient {
  if (client) return client;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new ConfigError(
      'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy apps/mobile/.env.example to .env.local.',
    );
  }
  client = createClient<Database>(url, key, {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}
