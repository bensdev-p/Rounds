import type { RoundsClient } from '@rounds/shared/api';
import { createContext, useContext, type ReactNode } from 'react';
import { ErrorView, Loading } from '@/components/StatusView';
import { getSupabase } from './supabase';
import { useAsync } from './useAsync';
import { loadErrorMessage } from './errors';

const ClientContext = createContext<RoundsClient | null>(null);

/**
 * Stage 1: every visitor is an anonymous Supabase user, so RLS keeps their
 * progress private without an account. The session is persisted, so the same
 * student comes back after a reload. Real accounts arrive in Stage 2.
 */
async function ensureSignedIn(): Promise<RoundsClient> {
  const client = getSupabase();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!data.session) {
    const signIn = await client.auth.signInAnonymously();
    if (signIn.error) throw signIn.error;
  }
  return client;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAsync(ensureSignedIn, 'auth');

  if (auth.status === 'loading') return <Loading label="Signing in" />;
  if (auth.status === 'error') {
    return (
      <ErrorView
        message={loadErrorMessage("Couldn't sign in.", auth.error)}
        onRetry={auth.reload}
      />
    );
  }
  return <ClientContext.Provider value={auth.data}>{children}</ClientContext.Provider>;
}

/** The signed-in Supabase client. Only usable inside <AuthProvider>. */
export function useClient(): RoundsClient {
  const client = useContext(ClientContext);
  if (!client) throw new Error('useClient must be used inside <AuthProvider>');
  return client;
}
