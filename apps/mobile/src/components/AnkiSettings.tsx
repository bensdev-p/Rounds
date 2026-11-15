/**
 * Settings → Anki (wireframe 12, note 1; M3.3). Connect Anki shows a one-time
 * code for the Rounds add-on: no password is typed into Anki. While the code
 * shows, the panel checks every few seconds and turns into the connected
 * state once the add-on claims it. The connected state and Disconnect aren't
 * drawn; they follow the Account screen's patterns.
 */
import {
  ankiConnection,
  codeMinutesLeft,
  lastSyncedLabel,
  type AnkiConnection,
  type AnkiPairingCode,
} from '@rounds/shared';
import { disconnectAnki, getAnkiPairing, startAnkiPairing } from '@rounds/shared/api';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useClient } from '@/lib/auth';
import { isUnreachable } from '@/lib/errors';
import { space } from '@/theme';
import { Button, Panel } from '@/ui/controls';
import { Txt } from '@/ui/Text';

const POLL_MS = 3000;

interface Code {
  code: string;
  expiresAt: Date;
}

function messageFor(e: unknown): string {
  if (e instanceof Error && isUnreachable(e)) return "Can't reach Rounds. Check your connection.";
  return 'Something went wrong. Try again.';
}

export function AnkiSettings() {
  const client = useClient();
  const [connection, setConnection] = useState<AnkiConnection | null>(null);
  const [code, setCode] = useState<Code | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = ankiConnection(await getAnkiPairing(client));
      if (!mounted.current) return;
      setConnection(next);
      if (next.state === 'connected') setCode(null);
    } catch (e) {
      if (mounted.current) setError(messageFor(e));
    }
  }, [client]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  // While a code is showing: watch for the add-on claiming it, and count down.
  const expired = code !== null && codeMinutesLeft(code.expiresAt, now) === 0;
  useEffect(() => {
    if (!code || expired) return;
    const timer = setInterval(() => {
      setNow(new Date());
      void refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [code, expired, refresh]);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const fresh: AnkiPairingCode = await startAnkiPairing(client);
      const started = new Date();
      setNow(started);
      setCode({
        code: fresh.code,
        expiresAt: new Date(started.getTime() + fresh.expires_in * 1000),
      });
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      await disconnectAnki(client);
      setConfirming(false);
      setConnection({ state: 'none' });
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  const errorLine = error && (
    <Txt variant="small" tone="miss" style={styles.line} accessibilityLiveRegion="polite">
      {error}
    </Txt>
  );

  if (connection?.state === 'connected') {
    return (
      <Panel>
        <Txt variant="body" weight="bodySemi">
          Anki connected
        </Txt>
        <Txt variant="small" tone="text2" style={styles.lineTight}>
          {lastSyncedLabel(connection.lastSyncAt, new Date())}. Anki syncs with Rounds when you open
          or close it.
        </Txt>
        {confirming ? (
          <>
            <Txt variant="body" style={styles.line}>
              Anki stops syncing with Rounds. Cards already changed stay as they are.
            </Txt>
            <Button
              variant="line"
              label="Disconnect"
              disabled={busy}
              onPress={() => void disconnect()}
              style={styles.button}
            />
            <Button
              variant="quiet"
              label="Keep connected"
              disabled={busy}
              onPress={() => setConfirming(false)}
              style={styles.buttonTight}
            />
          </>
        ) : (
          <Button
            variant="line"
            label="Disconnect"
            accessibilityHint="Asks before disconnecting"
            onPress={() => setConfirming(true)}
            style={styles.button}
          />
        )}
        {errorLine}
      </Panel>
    );
  }

  return (
    <Panel>
      <Txt variant="body">See what you missed on rounds in your Anki.</Txt>
      <Txt variant="small" tone="text2" style={styles.lineTight}>
        For Anki on a computer. Rounds reads card ids, never card text.
      </Txt>
      <Button
        label="Connect Anki"
        disabled={busy || connection === null}
        accessibilityHint={code ? 'Shows a new code' : 'Shows a code to enter in Anki'}
        onPress={() => void connect()}
        style={styles.button}
      />
      {code && !expired && (
        <View accessibilityLiveRegion="polite">
          <Txt variant="meta" tone="text2" style={styles.line}>
            {'Install the Rounds add-on, then enter this code: '}
            <Txt
              variant="meta"
              weight="bodySemi"
              tabular
              accessibilityLabel={code.code.split('').join(' ')}
            >
              {code.code}
            </Txt>
          </Txt>
          <Txt variant="small" tone="text2" style={styles.lineTight}>
            {`Works once, for ${codeMinutesLeft(code.expiresAt, now)} more min.`}
          </Txt>
        </View>
      )}
      {code && expired && (
        <Txt variant="meta" tone="text2" style={styles.line}>
          That code expired. Tap Connect Anki for a new one.
        </Txt>
      )}
      {errorLine}
    </Panel>
  );
}

const styles = StyleSheet.create({
  lineTight: { marginTop: space.xs },
  line: { marginTop: space.md },
  button: { marginTop: space.lg },
  buttonTight: { marginTop: space.sm },
});
