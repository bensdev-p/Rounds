import { RUNGS } from '@rounds/shared';
import { listPimpableScripts } from '@rounds/shared/api';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Disclaimer } from '@/components/Disclaimer';
import { ErrorView, Loading } from '@/components/StatusView';
import { useClient } from '@/lib/auth';
import { useAsync } from '@/lib/useAsync';
import { space, useTheme } from '@/theme';

export default function PimpHome() {
  const theme = useTheme();
  const client = useClient();
  const scripts = useAsync(() => listPimpableScripts(client), 'scripts');
  const { reload } = scripts;

  // Refresh best scores when coming back from a ladder (not on first mount).
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) reload();
      focused.current = true;
    }, [reload]),
  );

  if (scripts.status === 'loading') return <Loading label="Loading scripts" />;
  if (scripts.status === 'error') {
    return (
      <ErrorView message={`Couldn't load scripts. ${scripts.error.message}`} onRetry={reload} />
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={scripts.data}
      keyExtractor={(s) => s.script.id}
      ListHeaderComponent={
        <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>
          Pick a script
        </Text>
      }
      ListEmptyComponent={
        <Text style={[styles.meta, { color: theme.muted }]}>
          No approved scripts yet. Run `pnpm content:seed && pnpm db:reset` locally.
        </Text>
      }
      renderItem={({ item: { script, bestRung } }) => (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.name, { color: theme.text }]}>{script.name}</Text>
          <Text style={[styles.meta, { color: theme.muted }]}>
            {script.rotation.join(' · ')} ·{' '}
            {bestRung === null ? 'Not tried yet' : `Best: ${bestRung} / ${RUNGS.length}`}
          </Text>
          <Button
            label="Pimp me"
            accessibilityLabel={`Pimp me on ${script.name}`}
            accessibilityHint="Starts a question ladder that ends on your first miss"
            onPress={() =>
              router.push({ pathname: '/ladder/[scriptId]', params: { scriptId: script.id } })
            }
          />
        </View>
      )}
      ListFooterComponent={<Disclaimer />}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: space.md, gap: space.md },
  heading: { fontSize: 22, fontWeight: '700' },
  card: { padding: space.md, borderRadius: 12, borderWidth: 1, gap: space.sm },
  name: { fontSize: 18, fontWeight: '600' },
  meta: { fontSize: 14 },
});
