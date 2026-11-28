/** Script picker. Wireframe 03: best rung per script so weak topics stand out. */
import {
  detectPhi,
  matchesTopicFilter,
  normalize,
  phiWarning,
  sameTopicFilter,
  topicChips,
  type PersonaId,
  type TopicFilter,
} from '@rounds/shared';
import { listPimpableScripts } from '@rounds/shared/api';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ErrorView, Loading } from '@/components/StatusView';
import { useClient } from '@/lib/auth';
import { parsePersona } from '@/lib/prefs';
import { useAsync } from '@/lib/useAsync';
import { radius, size, space, type, useTheme } from '@/theme';
import { Chip, Link, List, Row } from '@/ui/controls';
import { MiniLadder } from '@/ui/progress';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Text';
import { PhiWarning } from '@/ui/PhiWarning';
import { noWebOutline } from '@/ui/webStyles';
import { loadErrorMessage } from '@/lib/errors';

export default function Topics() {
  const { c } = useTheme();
  const client = useClient();
  const params = useLocalSearchParams<{ persona?: string }>();
  const persona: PersonaId = parsePersona(params.persona) ?? 'teacher';
  const scripts = useAsync(() => listPimpableScripts(client), 'topics');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<TopicFilter>({ type: 'all' });

  if (scripts.status === 'loading') return <Loading label="Loading topics" />;
  if (scripts.status === 'error') {
    return (
      <ErrorView
        message={loadErrorMessage("Couldn't load topics.", scripts.error)}
        onRetry={scripts.reload}
      />
    );
  }

  // A diagnosis search, like the patient log: names are checked too.
  const phi = phiWarning(detectPhi(query, { checkNames: true }));
  const needle = phi ? '' : normalize(query);
  const chips = topicChips(scripts.data.map(({ script }) => script));
  const shown = scripts.data.filter(
    ({ script }) =>
      matchesTopicFilter(script, filter) &&
      (!needle || [script.name, ...script.aliases].some((n) => normalize(n).includes(needle))),
  );

  return (
    <Screen tab>
      <Link
        label="Pimp"
        icon={ChevronLeft}
        back
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
      <Txt variant="h1" accessibilityRole="header" style={styles.title}>
        Choose a topic
      </Txt>

      <View
        style={[styles.field, { backgroundColor: c.surface, borderColor: phi ? c.miss : c.line }]}
      >
        <Search size={20} color={c.text2} />
        <TextInput
          accessibilityLabel="Search diagnoses"
          value={query}
          onChangeText={setQuery}
          placeholder="Search diagnoses"
          placeholderTextColor={c.text3}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={80}
          style={[styles.input, type('body'), noWebOutline, { color: c.text }]}
        />
      </View>
      {phi && <PhiWarning message={phi} />}

      {chips.length > 2 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chips}
        >
          {chips.map((chip) => (
            <Chip
              key={chip.label}
              label={chip.label}
              role="button"
              selected={sameTopicFilter(chip.filter, filter)}
              accessibilityHint="Shows only these topics"
              onPress={() => setFilter(chip.filter)}
            />
          ))}
        </ScrollView>
      )}

      <View style={styles.list}>
        {shown.length === 0 ? (
          <Txt variant="meta" tone="text2">
            {scripts.data.length === 0
              ? 'No approved scripts yet.'
              : needle
                ? 'No topic matches that search.'
                : 'No topics under this filter yet.'}
          </Txt>
        ) : (
          <List>
            {shown.map(({ script, bestRung }, i) => (
              <Row
                key={script.id}
                first={i === 0}
                title={script.name}
                subtitle={[
                  bestRung === null ? 'Not tried' : `Best rung ${bestRung}`,
                  script.status === 'in_review' ? 'Not yet reviewed' : null,
                ]
                  .filter(Boolean)
                  .join('  ·  ')}
                accessibilityHint="Starts a session on this topic"
                onPress={() =>
                  router.push({
                    pathname: '/session/[scriptId]',
                    params: { scriptId: script.id, persona },
                  })
                }
                trailing={
                  <View style={styles.trailing}>
                    <MiniLadder best={bestRung ?? 0} />
                    <ChevronRight size={20} color={c.text3} />
                  </View>
                }
              />
            ))}
          </List>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 14, marginBottom: space.xl },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: size.fieldHeight,
    paddingHorizontal: space.lg,
    borderRadius: radius.field,
    borderWidth: 1.5,
  },
  input: { flex: 1, height: '100%' },
  chipScroll: { marginTop: space.lg, flexGrow: 0 },
  chips: { flexDirection: 'row', gap: space.sm },
  list: { marginTop: space.section },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
