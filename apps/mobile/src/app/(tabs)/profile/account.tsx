/**
 * Account, from Settings ("Account and subscription" in wireframe 12; named
 * Account until payments arrive in Stage 4). Not drawn: built from the
 * existing pieces. Email sign-in uses a 6-digit code, which also works on a
 * phone opening the local web app. Sign in with Apple shows in the iPhone
 * build only.
 */
import {
  EmailSchema,
  WrongCodeError,
  listFinishedSessions,
  sendAddEmailCode,
  sendSignInCode,
  verifyEmailCode,
  type EmailCodeKind,
} from '@rounds/shared/api';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Disclaimer } from '@/components/Disclaimer';
import { appleSignInAvailable, signInWithApple } from '@/lib/appleSignIn';
import { useAccount, useClient } from '@/lib/auth';
import { isUnreachable } from '@/lib/errors';
import { radius, size, space, type, useTheme } from '@/theme';
import { Button, Link, List, Row } from '@/ui/controls';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Text';
import { noWebOutline } from '@/ui/webStyles';

export default function Account() {
  const { account } = useAccount();
  return (
    <Screen tab>
      <Link
        label="Settings"
        icon={ChevronLeft}
        back
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile/settings'))}
      />
      <Txt variant="h1" accessibilityRole="header" style={styles.title}>
        Account
      </Txt>
      {account.isAnonymous ? <SignIn /> : <SignedIn />}
      <Disclaimer />
    </Screen>
  );
}

// ─── Signing in ─────────────────────────────────────────────────────────────

type Step =
  | { name: 'email' }
  /** The email (or Apple ID) already has an account: warn before switching. */
  | { name: 'exists'; email: string | null; switchTo: () => Promise<void> }
  | { name: 'code'; email: string; kind: EmailCodeKind };

function messageFor(e: unknown): string {
  if (e instanceof WrongCodeError) {
    return "That code didn't work. Use the newest email's code, or send a new one.";
  }
  if (e instanceof Error && isUnreachable(e)) return "Can't reach PimpMe. Check the connection.";
  return e instanceof Error ? e.message : 'Something went wrong. Try again.';
}

function SignIn() {
  const client = useClient();
  const [step, setStep] = useState<Step>({ name: 'email' });
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apple, setApple] = useState(false);

  useEffect(() => {
    void appleSignInAvailable().then(setApple);
  }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  /** Switching accounts leaves this phone's anonymous practice behind; warn only if there is some. */
  async function switchOrWarn(address: string | null, switchTo: () => Promise<void>) {
    const practised = (await listFinishedSessions(client)).length > 0;
    if (practised) setStep({ name: 'exists', email: address, switchTo });
    else await switchTo();
  }

  const codeStep = (address: string, kind: EmailCodeKind) => () => {
    setCode('');
    setStep({ name: 'code', email: address, kind });
  };

  const sendCode = () =>
    run(async () => {
      const address = email.trim();
      if ((await sendAddEmailCode(client, address)) === 'sent') {
        codeStep(address, 'add_email')();
        return;
      }
      await switchOrWarn(address, async () => {
        await sendSignInCode(client, address);
        codeStep(address, 'sign_in')();
      });
    });

  const appleSignIn = () =>
    run(async () => {
      const result = await signInWithApple(client);
      if (result.kind === 'exists') await switchOrWarn(null, result.signIn);
    });

  if (step.name === 'exists') {
    return (
      <View>
        <Txt variant="body" style={styles.lead}>
          {step.email ?? 'That Apple ID'} already has a PimpMe account. Signing in switches this
          phone to it, and the practice done here without an account stays behind.
        </Txt>
        <Button
          label={step.email ? 'Send sign-in code' : 'Switch to that account'}
          disabled={busy}
          onPress={() => run(step.switchTo)}
          style={styles.action}
        />
        <ErrorLine error={error} />
        <View style={styles.links}>
          <Link label="Use a different email" onPress={() => setStep({ name: 'email' })} />
        </View>
      </View>
    );
  }

  if (step.name === 'code') {
    const ready = /^\d{6}$/.test(code.replace(/\s/g, ''));
    return (
      <View>
        <Txt variant="body" style={styles.lead}>
          Enter the 6-digit code sent to {step.email}.
        </Txt>
        <Field
          accessibilityLabel="6-digit code"
          value={code}
          onChangeText={setCode}
          placeholder="6-digit code"
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={7}
        />
        <Button
          label="Sign in"
          disabled={!ready || busy}
          onPress={() => run(() => verifyEmailCode(client, step.email, code, step.kind))}
          style={styles.action}
        />
        <ErrorLine error={error} />
        <View style={styles.links}>
          <Link
            label="Send a new code"
            onPress={() =>
              run(async () => {
                if (step.kind === 'add_email') await sendAddEmailCode(client, step.email);
                else await sendSignInCode(client, step.email);
              })
            }
          />
          <Link label="Use a different email" onPress={() => setStep({ name: 'email' })} />
        </View>
      </View>
    );
  }

  return (
    <View>
      <Txt variant="body" style={styles.lead}>
        {
          "You're using PimpMe without an account. Sign in to keep your rungs, rank and misses on any phone. Anki sync and teams will use your account too, when they come."
        }
      </Txt>
      <Field
        accessibilityLabel="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        maxLength={254}
      />
      <Button
        label="Send code"
        disabled={!EmailSchema.safeParse(email.trim()).success || busy}
        onPress={sendCode}
        style={styles.action}
      />
      {apple && <AppleButton disabled={busy} onPress={appleSignIn} />}
      <ErrorLine error={error} />
    </View>
  );
}

function AppleButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  const { scheme } = useTheme();
  return (
    <View
      pointerEvents={disabled ? 'none' : 'auto'}
      style={[styles.action, { opacity: disabled ? 0.45 : 1 }]}
    >
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={
          scheme === 'dark'
            ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
        }
        cornerRadius={size.buttonHeight / 2}
        style={{ height: size.buttonHeight }}
        onPress={onPress}
      />
    </View>
  );
}

// ─── Signed in ──────────────────────────────────────────────────────────────

function SignedIn() {
  const { account, signOut, deleteAccount } = useAccount();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(messageFor(e));
      setBusy(false);
    }
  }

  return (
    <View>
      <View style={styles.lead}>
        <List>
          <Row
            first
            title={account.email ?? 'Apple ID'}
            subtitle={
              account.provider === 'apple' ? 'Signed in with Apple' : 'Signed in with email'
            }
          />
        </List>
      </View>
      <Txt variant="small" tone="text2" style={styles.caption}>
        Your progress is kept with this account. Sign in on another phone to pick it up there.
      </Txt>

      <Button
        variant="quiet"
        label="Sign out"
        disabled={busy}
        accessibilityHint="This phone starts fresh until you sign in again"
        onPress={() => run(signOut)}
        style={styles.action}
      />

      {confirming ? (
        <View style={styles.confirm}>
          <Txt variant="body">
            {
              "This deletes your account and everything in it: sessions, misses, logged patients and your rank. It can't be undone."
            }
          </Txt>
          <Button
            variant="line"
            label="Delete account"
            disabled={busy}
            onPress={() => run(deleteAccount)}
            style={styles.action}
          />
          <Button
            variant="quiet"
            label="Keep my account"
            disabled={busy}
            onPress={() => setConfirming(false)}
            style={styles.actionTight}
          />
        </View>
      ) : (
        <View style={styles.links}>
          <Link label="Delete account" onPress={() => setConfirming(true)} />
        </View>
      )}
      <ErrorLine error={error} />
    </View>
  );
}

// ─── Pieces ─────────────────────────────────────────────────────────────────

function Field(props: TextInputProps) {
  const { c } = useTheme();
  return (
    <TextInput
      {...props}
      placeholderTextColor={c.text3}
      autoCapitalize="none"
      autoCorrect={false}
      style={[
        styles.field,
        type('body'),
        noWebOutline,
        { color: c.text, backgroundColor: c.surface, borderColor: c.line },
      ]}
    />
  );
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <Txt variant="small" tone="miss" accessibilityRole="alert" style={styles.caption}>
      {error}
    </Txt>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.md },
  lead: { marginTop: space.xl, marginBottom: space.lg },
  field: {
    height: size.fieldHeight,
    paddingHorizontal: space.lg,
    borderRadius: radius.field,
    borderWidth: 1.5,
  },
  action: { marginTop: space.md },
  actionTight: { marginTop: space.sm },
  caption: { marginTop: space.md },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xl },
  confirm: { marginTop: space.section },
});
