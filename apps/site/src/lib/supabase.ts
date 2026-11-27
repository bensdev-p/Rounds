import { createClient } from '@supabase/supabase-js';
import type { Database } from '@rounds/shared';
import type { RoundsClient } from '@rounds/shared/api';

/**
 * The site's Supabase client, for the daily pimp (M4.3). Same project as the
 * app: `.env.production` points builds at rounds-dev, `.env.development.local`
 * points `pnpm site` at the local stack (see `.env.example`). Created in the
 * browser only: the site is a static export.
 */
let client: RoundsClient | null = null;

export function supabase(): RoundsClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || typeof window === 'undefined') return null;
  client ??= createClient<Database>(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'pimpme-site-auth' },
  });
  return client;
}
