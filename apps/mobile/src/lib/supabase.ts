import type { Database } from '@rounds/shared';
import type { RoundsClient } from '@rounds/shared/api';
import { createClient } from '@supabase/supabase-js';
import { authStorage } from './authStorage';

let client: RoundsClient | null = null;

export class ConfigError extends Error {
  override name = 'ConfigError';
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Local Supabase runs on the same computer that serves the app. When the web
 * app is opened from a phone on the home Wi-Fi (http://<computer-ip>:8081),
 * "127.0.0.1" would mean the phone itself, so point at the computer instead.
 */
export function reachableUrl(url: string, pageHost?: string): string {
  const host =
    pageHost ?? (typeof window !== 'undefined' ? window.location?.hostname : undefined);
  if (!host || LOOPBACK.has(host)) return url;
  const parsed = new URL(url);
  if (!LOOPBACK.has(parsed.hostname)) return url;
  parsed.hostname = host;
  return parsed.toString().replace(/\/$/, '');
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
  client = createClient<Database>(reachableUrl(url), key, {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}
