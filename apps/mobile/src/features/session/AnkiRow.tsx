/**
 * The Anki row on the result screen (wireframe 07 note 3, result.png; M3.4).
 * After a miss on a script with linked notes: "Unsuspend 3 Anki cards", which
 * queues the cards for the add-on's next sync, or "Connect Anki" when Anki
 * isn't connected. The queued state isn't drawn; it keeps the row and swaps
 * the chevron for a check. Which row shows is `resultAnkiRow` in shared.
 */
import {
  ankiCards,
  ankiConnection,
  linkedNotesOf,
  noteIdsForMiss,
  resultAnkiRow,
  type IllnessScript,
  type Rung,
} from '@rounds/shared';
import {
  getAnkiPairing,
  listAnkiActions,
  listAnkiCardStates,
  queueAnkiAction,
} from '@rounds/shared/api';
import { router, useFocusEffect } from 'expo-router';
import { Check, ChevronRight } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useClient } from '@/lib/auth';
import { useAsync } from '@/lib/useAsync';
import { space, useTheme } from '@/theme';
import { List, Row } from '@/ui/controls';

const SYNCS = 'Syncs next time Anki opens';

export function AnkiRow({
  script,
  missedRung,
}: {
  script: Pick<IllnessScript, 'id' | 'anki_refs'>;
  /** The rung the session ended on; null after a clean run. */
  missedRung: Rung | null;
}) {
  const { c } = useTheme();
  const client = useClient();
  const linked = linkedNotesOf(script);
  const hasNotes =
    missedRung !== null && noteIdsForMiss(linked, script.id, missedRung).noteIds.length > 0;
  const [queued, setQueued] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const data = useAsync(
    async () => {
      if (!hasNotes) return null;
      const connection = ankiConnection(await getAnkiPairing(client));
      if (connection.state !== 'connected') {
        return { connection, cards: [], actions: [] };
      }
      const { noteIds } = noteIdsForMiss(linked, script.id, missedRung);
      const [cards, actions] = await Promise.all([
        listAnkiCardStates(client, noteIds),
        // Pending actions only: applied ones are left out by a `since` in the future.
        listAnkiActions(client, new Date(Date.now() + 86_400_000)),
      ]);
      return { connection, cards, actions };
    },
    `anki-row|${script.id}|${missedRung ?? ''}`,
  );
  const { reload } = data;

  // Back from Settings after connecting: look again.
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) reload();
      focused.current = true;
    }, [reload]),
  );

  if (data.status !== 'ready' || data.data === null) return null;
  const row = resultAnkiRow({ ...data.data, linked, scriptId: script.id, missedRung });
  if (row.kind === 'hidden') return null;

  if (row.kind === 'connect') {
    return (
      <View style={styles.wrap}>
        <List>
          <Row
            first
            title="Connect Anki"
            subtitle="Unsuspend the cards for what you missed"
            trailing={<ChevronRight size={18} color={c.text3} />}
            accessibilityHint="Opens Settings to connect Anki"
            onPress={() => router.push('/profile/settings')}
          />
        </List>
      </View>
    );
  }

  if (queued || row.kind === 'queued') {
    return (
      <View style={styles.wrap}>
        <List>
          <Row
            first
            title={`${ankiCards(row.cards)} queued`}
            subtitle={SYNCS}
            trailing={<Check size={18} color={c.pass} />}
          />
        </List>
      </View>
    );
  }

  async function unsuspend() {
    if (busy || missedRung === null) return;
    setBusy(true);
    setFailed(false);
    try {
      await queueAnkiAction(client, { script_id: script.id, rung: missedRung, kind: 'unsuspend' });
      setQueued(true);
    } catch (e) {
      console.warn('[rounds] queueing Anki action failed', e);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <List>
        <Row
          first
          title={`Unsuspend ${ankiCards(row.cards)}`}
          subtitle={failed ? "Couldn't queue. Tap to try again." : SYNCS}
          trailing={<ChevronRight size={18} color={c.text3} />}
          accessibilityHint="Unsuspends these cards next time Anki syncs"
          onPress={() => void unsuspend()}
        />
      </List>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.md },
});
