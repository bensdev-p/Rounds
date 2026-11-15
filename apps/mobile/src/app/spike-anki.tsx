/**
 * M3.1 SPIKE ONLY (branch m3.1-anki-spike, never merged). Hidden page,
 * http://localhost:8081/spike-anki. Not a design: it stands in for
 * Settings → Anki (wireframe 12) and the result screen's "Unsuspend 3 Anki
 * cards" (result.png) so pairing and actions can be tried end to end.
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { getSupabase } from '../lib/supabase';
import { Button } from '../ui/controls';
import { Screen } from '../ui/Screen';
import { Txt } from '../ui/Text';

type Status = {
  pairing: { claimed_at: string; last_sync_at: string | null } | null;
  stats: { card_id: number; note_id: number; suspended: boolean; lapses: number }[];
  actions: {
    id: string;
    kind: string;
    card_ids: number[];
    created_at: string;
    applied_at: string | null;
    applied_count: number | null;
  }[];
};

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke('anki-spike', { body });
  if (error) throw error;
  return data as T;
}

export default function SpikeAnki() {
  const [code, setCode] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    try {
      setStatus(await call<Status>({ op: 'status' }));
    } catch (e) {
      setMessage(String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 3000);
    return () => clearInterval(timer);
  }, [refresh]);

  const suspended = status?.stats.filter((s) => s.suspended) ?? [];

  return (
    <Screen>
      <Txt variant="h1" accessibilityRole="header">
        Anki spike
      </Txt>
      <View style={styles.block}>
        <Button
          label="Get a code"
          onPress={async () => {
            const r = await call<{ code: string }>({ op: 'start' });
            setCode(r.code);
          }}
        />
        <Txt>
          {code
            ? `Install the Rounds add-on, then enter this code: ${code}`
            : 'No code yet (valid 10 minutes, single use).'}
        </Txt>
      </View>
      <View style={styles.block}>
        <Txt variant="meta" tone="text2">
          {status?.pairing
            ? `Connected ${new Date(status.pairing.claimed_at).toLocaleTimeString()}. Last sync: ${
                status.pairing.last_sync_at
                  ? new Date(status.pairing.last_sync_at).toLocaleTimeString()
                  : 'never'
              }`
            : 'Not connected'}
        </Txt>
        <Txt>
          {`${status?.stats.length ?? 0} linked cards uploaded, ${suspended.length} suspended.`}
        </Txt>
        <Button
          variant="line"
          label={`Unsuspend ${Math.min(3, suspended.length)} Anki cards`}
          disabled={suspended.length === 0}
          onPress={async () => {
            const ids = suspended.slice(0, 3).map((s) => s.card_id);
            await call({ op: 'queue', kind: 'unsuspend', card_ids: ids });
            await call({ op: 'queue', kind: 'tag_missed', card_ids: ids });
            setMessage('Queued. Syncs next time Anki opens (or Tools → Rounds spike → Sync).');
            void refresh();
          }}
        />
      </View>
      <View style={styles.block}>
        {status?.actions.map((a) => (
          <Txt key={a.id} variant="small" tone="text2">
            {`${a.kind} ${a.card_ids.length} card(s): ${
              a.applied_at
                ? `applied ${new Date(a.applied_at).toLocaleTimeString()} (${a.applied_count})`
                : 'waiting for Anki'
            }`}
          </Txt>
        ))}
        {message ? <Txt variant="small">{message}</Txt> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12, marginTop: 24 },
});
