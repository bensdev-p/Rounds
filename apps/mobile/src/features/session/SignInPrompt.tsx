/**
 * "Keep your progress": wireframe 01 note 2 asks for sign-in after the first
 * session, not before. Not drawn. A quiet panel on the result screen, shown
 * once to a student without an account; Settings → Account is always there.
 */
import { shouldAskToSignIn } from '@rounds/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAccount } from '@/lib/auth';
import { useSignInAsked } from '@/lib/prefs';
import { space } from '@/theme';
import { Button, Link, Panel } from '@/ui/controls';
import { Txt } from '@/ui/Text';

export function SignInPrompt({ finishedLadders }: { finishedLadders: number }) {
  const { account } = useAccount();
  const [alreadyAsked, setAsked] = useSignInAsked();
  // Decided once when the result appears, so marking it asked doesn't hide it.
  const [show] = useState(() =>
    shouldAskToSignIn({ isAnonymous: account.isAnonymous, finishedLadders, alreadyAsked }),
  );
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (show) setAsked(true);
  }, [show, setAsked]);

  if (!show || dismissed) return null;
  return (
    <Panel style={styles.panel}>
      <Txt variant="h3" accessibilityRole="header">
        Keep your progress
      </Txt>
      <Txt variant="meta" tone="text2" style={styles.body}>
        Sign in to keep your rungs, rank and misses on any phone. Anki sync and teams will use your
        account too, when they come.
      </Txt>
      <View style={styles.actions}>
        <Button
          variant="quiet"
          label="Sign in"
          onPress={() => router.push('/profile/account')}
          style={styles.signIn}
        />
        <Link label="Not now" onPress={() => setDismissed(true)} />
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: space.xl },
  body: { marginTop: space.xs },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.xl, marginTop: space.lg },
  signIn: { flex: 1 },
});
