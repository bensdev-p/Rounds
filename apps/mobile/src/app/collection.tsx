/**
 * Script collection. Wireframe 15. Every script as a tile with its mini
 * ladder: mastered tiles get an amber outline, re-check due a dashed one.
 * Tap opens the script; long-press starts a session on it.
 */
import { collectionTiles, type MasteryStatus } from '@rounds/shared';
import { listFinishedSessions, listPimpableScripts } from '@rounds/shared/api';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ErrorView, Loading } from '@/components/StatusView';
import { useClient } from '@/lib/auth';
import { ROTATION_NAMES } from '@/lib/copy';
import { loadErrorMessage } from '@/lib/errors';
import { usePersona } from '@/lib/prefs';
import { useAsync } from '@/lib/useAsync';
import { radius, space, useTheme } from '@/theme';
import { Link, Segmented } from '@/ui/controls';
import { MiniLadder } from '@/ui/progress';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Text';

type Filter = 'all' | 'mastered' | 'due' | 'new';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'mastered', label: 'Mastered' },
  { value: 'due', label: 'Due' },
  { value: 'new', label: 'New' },
];
const SHOWS: Record<Filter, (s: MasteryStatus) => boolean> = {
  all: () => true,
  mastered: (s) => s === 'mastered',
  due: (s) => s === 'recheck_due',
  new: (s) => s === 'not_tried',
};
const STATUS_TEXT: Record<MasteryStatus, string> = {
  mastered: 'Mastered',
  recheck_due: 'Re-check due',
  in_progress: 'In progress',
  not_tried: 'Not tried',
};

export default function Collection() {
  const { c } = useTheme();
  const client = useClient();
  const [persona] = usePersona();
  const [filter, setFilter] = useState<Filter>('all');
  const data = useAsync(async () => {
    const [scripts, sessions] = await Promise.all([
      listPimpableScripts(client),
      listFinishedSessions(client),
    ]);
    return { scripts, sessions };
  }, 'collection');

  if (data.status === 'loading') return <Loading label="Loading scripts" />;
  if (data.status === 'error') {
    return (
      <ErrorView
        message={loadErrorMessage("Couldn't load scripts.", data.error)}
        onRetry={data.reload}
      />
    );
  }

  const { scripts, sessions } = data.data;
  const byId = new Map(scripts.map((s) => [s.script.id, s.script]));
  const tiles = collectionTiles([...byId.keys()], sessions, new Date());
  const mastered = tiles.filter((t) => t.status === 'mastered').length;
  const shown = tiles.filter((t) => SHOWS[filter](t.status));
  const rotation = ROTATION_NAMES[scripts[0]?.script.rotation[0] ?? 'IM'];

  return (
    <Screen>
      <Link
        label="Progress"
        icon={ChevronLeft}
        back
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/progress'))}
      />
      <Txt variant="h1" accessibilityRole="header" style={styles.title}>
        {rotation}
      </Txt>
      <Txt variant="meta" tone="text2" style={styles.sub}>
        <Txt variant="h2" fontSize={17} lineHeight={20} tabular>
          {mastered}
        </Txt>{' '}
        of {tiles.length} mastered
      </Txt>

      <View style={styles.filters}>
        <Segmented label="Show" options={FILTERS} value={filter} onChange={setFilter} />
      </View>

      <View style={styles.tiles}>
        {shown.length === 0 && (
          <Txt variant="meta" tone="text2">
            {filter === 'due' ? 'Nothing due for a re-check.' : 'None here yet.'}
          </Txt>
        )}
        {shown.map((t) => {
          const script = byId.get(t.script_id);
          if (!script) return null;
          return (
            <Pressable
              key={t.script_id}
              accessibilityRole="button"
              accessibilityLabel={`${script.name}. ${STATUS_TEXT[t.status]}${t.best ? `, best rung ${t.best}` : ''}`}
              accessibilityHint="Opens the script. Long-press to start a session on it."
              onPress={() =>
                router.push({ pathname: '/script/[scriptId]', params: { scriptId: script.id } })
              }
              onLongPress={() =>
                router.push({
                  pathname: '/session/[scriptId]',
                  params: { scriptId: script.id, persona },
                })
              }
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: c.surface, opacity: pressed ? 0.85 : 1 },
                t.status === 'mastered' && { borderColor: c.signal },
                t.status === 'recheck_due' && { borderColor: c.line, borderStyle: 'dashed' },
              ]}
            >
              <View style={styles.tileName}>
                <Txt
                  variant="meta"
                  weight="bodyMedium"
                  lineHeight={17.5}
                  tone={t.status === 'not_tried' ? 'text3' : 'text'}
                >
                  {script.name}
                </Txt>
                {t.status === 'recheck_due' && (
                  <Txt variant="small" tone="ceil" style={styles.due}>
                    Re-check due
                  </Txt>
                )}
              </View>
              <MiniLadder best={t.best} mastered={t.status === 'mastered'} />
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 14 },
  sub: { marginTop: 6 },
  filters: { marginTop: space.lg },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: 14 },
  due: { marginTop: space.xs },
  tile: {
    width: '48.5%',
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: space.md,
    paddingLeft: 14,
    borderRadius: radius.row,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tileName: { flex: 1 },
});
