import type { Session } from '@supabase/supabase-js';
import { deleteAccount as deleteAccountOnServer, type RoundsClient } from '@rounds/shared/api';
import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ErrorView, Loading } from '@/components/StatusView';
import { getSupabase } from './supabase';
import { useAsync } from './useAsync';
import { loadErrorMessage } from './errors';

/** Who is signed in. Every student starts anonymous; signing in keeps the same id. */
export interface Account {
  id: string;
  isAnonymous: boolean;
  email: string | null;
  /** How they signed in, for the Account screen. */
  provider: 'email' | 'apple' | null;
}

interface AuthValue {
  client: RoundsClient;
  account: Account;
  /** Signs out, then starts a fresh anonymous student on this device. */
  signOut: () => Promise<void>;
  /** Deletes the account and everything in it, then starts fresh. */
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

function accountOf(session: Session): Account {
  const { user } = session;
  const providers = (user.identities ?? []).map((i) => i.provider);
  return {
    id: user.id,
    isAnonymous: user.is_anonymous ?? false,
    email: user.email ? user.email : null,
    provider: providers.includes('apple') ? 'apple' : providers.includes('email') ? 'email' : null,
  };
}

const sameAccount = (a: Account, b: Account) =>
  a.id === b.id &&
  a.isAnonymous === b.isAnonymous &&
  a.email === b.email &&
  a.provider === b.provider;

/**
 * No account wall (wireframe 01 note 2): a visitor becomes an anonymous
 * Supabase user, so RLS keeps their progress private from the first session.
 * The session is persisted, so the same student comes back after a reload.
 */
async function ensureSignedIn(): Promise<{ client: RoundsClient; session: Session }> {
  const client = getSupabase();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (data.session) return { client, session: data.session };
  const signIn = await client.auth.signInAnonymously();
  if (signIn.error) throw signIn.error;
  if (!signIn.data.session) throw new Error('No session after signing in');
  return { client, session: signIn.data.session };
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
  return (
    <SignedIn client={auth.data.client} initial={accountOf(auth.data.session)}>
      {children}
    </SignedIn>
  );
}

function SignedIn({
  client,
  initial,
  children,
}: {
  client: RoundsClient;
  initial: Account;
  children: ReactNode;
}) {
  const [account, setAccount] = useState(initial);

  // Follows sign-ins (a code, Apple) and the email being added.
  useEffect(() => {
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (!session) return;
      const next = accountOf(session);
      setAccount((current) => (sameAccount(current, next) ? current : next));
    });
    return () => data.subscription.unsubscribe();
  }, [client]);

  const startFresh = useCallback(async () => {
    await client.auth.signOut({ scope: 'local' });
    const { data, error } = await client.auth.signInAnonymously();
    if (error) throw error;
    if (data.session) setAccount(accountOf(data.session));
  }, [client]);

  const deleteAccount = useCallback(async () => {
    await deleteAccountOnServer(client);
    await startFresh();
  }, [client, startFresh]);

  const value = useMemo(
    () => ({ client, account, signOut: startFresh, deleteAccount }),
    [client, account, startFresh, deleteAccount],
  );
  return (
    <AuthContext.Provider value={value}>
      {/* A different student (signed in elsewhere, or signed out): every screen starts over. */}
      <Fragment key={account.id}>{children}</Fragment>
    </AuthContext.Provider>
  );
}

function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

/** The signed-in Supabase client. Only usable inside <AuthProvider>. */
export function useClient(): RoundsClient {
  return useAuth().client;
}

/** The signed-in student, and signing out or deleting the account. */
export function useAccount(): Omit<AuthValue, 'client'> {
  const { account, signOut, deleteAccount } = useAuth();
  return { account, signOut, deleteAccount };
}
