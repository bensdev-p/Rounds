/**
 * Sign in with Apple, in the iPhone build only. The web app (and so the phone
 * on the home Wi-Fi) offers email codes instead: Apple on the web needs a
 * Services ID, a verified domain and HTTPS.
 *
 * Supabase setup (hosted project): Authentication → Providers → Apple, with the
 * bundle id `com.ben.rounds` as a client id. No secret is needed for the
 * native flow.
 */
import type { RoundsClient } from '@rounds/shared/api';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

export async function appleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export type AppleResult =
  | { kind: 'linked' }
  | { kind: 'cancelled' }
  /** The Apple ID already has an account. Call `signIn` to switch to it. */
  | { kind: 'exists'; signIn: () => Promise<void> };

/**
 * Adds the student's Apple ID to their anonymous user, so the id and their
 * history stay. If the Apple ID already has an account, returns 'exists' so
 * the screen can warn before switching.
 */
export async function signInWithApple(client: RoundsClient): Promise<AppleResult> {
  const nonce = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashed,
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return { kind: 'cancelled' };
    throw e;
  }
  const token = credential.identityToken;
  if (!token) throw new Error('Apple did not return an identity token');

  const linked = await client.auth.linkIdentity({ provider: 'apple', token, nonce });
  if (!linked.error) return { kind: 'linked' };
  if (linked.error.code !== 'identity_already_exists') throw linked.error;
  return {
    kind: 'exists',
    signIn: async () => {
      const { error } = await client.auth.signInWithIdToken({ provider: 'apple', token, nonce });
      if (error) throw error;
    },
  };
}
