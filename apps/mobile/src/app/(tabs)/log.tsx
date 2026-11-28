/**
 * Log a patient (wireframe 08, mockup log.png, video scene 6). Diagnosis label,
 * rotation and time only (domain rule 5). The patient-detail guard runs on
 * every keystroke and turns Save off while it has found something. A log with
 * no matching script is still saved.
 */
import {
  diagnosisPhiWarning,
  matchScripts,
  patientCountLabel,
  startOfToday,
  type IllnessScript,
} from '@rounds/shared';
import {
  listFinishedSessions,
  listLogsSince,
  listPimpableScripts,
  logPatient,
} from '@rounds/shared/api';
import { useFocusEffect } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutAnimation, StyleSheet, TextInput, View } from 'react-native';
import { ErrorView, Loading } from '@/components/StatusView';
import { LoggedToday } from '@/features/log/LoggedToday';
import { useClient } from '@/lib/auth';
import { ROTATION_NAMES } from '@/lib/copy';
import { loadErrorMessage } from '@/lib/errors';
import { useProfile } from '@/lib/profile';
import { useAsync } from '@/lib/useAsync';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { radius, size, space, type, useTheme } from '@/theme';
import { Chip, List, Row, SectionHead } from '@/ui/controls';
import { PhiWarning } from '@/ui/PhiWarning';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Text';
import { noWebOutline } from '@/ui/webStyles';

export default function Log() {
  const { c } = useTheme();
  const client = useClient();
  const { profile } = useProfile();
  const reduceMotion = useReduceMotion();
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const data = useAsync(async () => {
    const [scripts, logs, sessions] = await Promise.all([
      listPimpableScripts(client),
      listLogsSince(client, startOfToday(new Date())),
      listFinishedSessions(client),
    ]);
    return { scripts, logs, sessions };
  }, 'log');
  const { reload } = data;

  // Statuses change after a session, so refresh when the tab comes back.
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) reload();
      focused.current = true;
    }, [reload]),
  );

  const warning = diagnosisPhiWarning(query);
  // The warning appears and collapses (video scene 6); instant with Reduce Motion.
  const flagged = warning !== null;
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [flagged, reduceMotion]);

  if (data.status === 'loading') return <Loading label="Loading your log" />;
  if (data.status === 'error') {
    return (
      <ErrorView
        message={loadErrorMessage("Couldn't load your log.", data.error)}
        onRetry={reload}
      />
    );
  }

  const { scripts, logs, sessions } = data.data;
  const now = new Date();
  const rotation = profile.rotation;
  const label = query.trim();
  // Patients are logged by diagnosis, so only disease scripts match.
  const matches = matchScripts(
    query,
    scripts.map((s) => s.script).filter((s) => s.kind === 'disease'),
  );
  // A diagnosis with no matching script is still saved, under what was typed.
  // Hidden while flagged, so the patient details are not echoed back.
  const offerTyped = label.length > 0 && !flagged && !matches.some((m) => m.exact);

  async function save(script: IllnessScript | null) {
    if (flagged || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await logPatient(client, {
        label: script ? script.name : label,
        script_id: script ? script.id : null,
        rotation,
      });
      setQuery('');
      reload();
    } catch {
      setSaveError("Couldn't save that. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen tab>
      <Txt variant="h1" accessibilityRole="header" style={styles.title}>
        Log a patient
      </Txt>
      <Txt variant="meta" tone="text2" style={styles.sub}>
        Diagnosis only. No names, dates or record numbers.
      </Txt>

      <View
        style={[
          styles.field,
          { backgroundColor: c.surface, borderColor: flagged ? c.miss : c.line },
        ]}
      >
        <Search size={20} color={c.text3} />
        <TextInput
          accessibilityLabel="Diagnosis"
          accessibilityHint="Type the diagnosis only. Matching scripts appear below."
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setSaveError(null);
          }}
          placeholder="Diagnosis"
          placeholderTextColor={c.text3}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={80}
          returnKeyType="done"
          style={[styles.input, type('body'), noWebOutline, { color: c.text }]}
        />
      </View>
      {warning && <PhiWarning message={warning} />}
      {saveError && <PhiWarning message={saveError} />}

      {(matches.length > 0 || offerTyped) && (
        <>
          <Txt variant="small" tone="text2" style={styles.matchHead}>
            Matching scripts
          </Txt>
          <List>
            {matches.map(({ item: script }, i) => (
              <Row
                key={script.id}
                first={i === 0}
                title={script.name}
                subtitle={[
                  ROTATION_NAMES[script.rotation[0] ?? rotation],
                  script.status === 'in_review' ? 'Not yet reviewed' : null,
                ]
                  .filter(Boolean)
                  .join('  ·  ')}
                trailing={
                  <Chip
                    role="button"
                    label="Save"
                    accessibilityLabel={`Save ${script.name}`}
                    accessibilityHint={flagged ? 'Remove the patient details first' : undefined}
                    disabled={flagged || saving}
                    onPress={() => void save(script)}
                  />
                }
              />
            ))}
            {offerTyped && (
              <Row
                first={matches.length === 0}
                title={label}
                subtitle="No script yet"
                trailing={
                  <Chip
                    role="button"
                    label="Save"
                    accessibilityLabel={`Save ${label} without a script`}
                    accessibilityHint={flagged ? 'Remove the patient details first' : undefined}
                    disabled={flagged || saving}
                    onPress={() => void save(null)}
                  />
                }
              />
            )}
          </List>
        </>
      )}

      <SectionHead
        title="Logged today"
        right={
          logs.length > 0 ? (
            <Txt variant="small" tone="text2" tabular>
              {patientCountLabel(logs.length)}
            </Txt>
          ) : undefined
        }
      />
      <LoggedToday logs={logs} sessions={sessions} now={now} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.md },
  sub: { marginTop: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: size.fieldHeight,
    marginTop: 22,
    paddingHorizontal: space.lg,
    borderRadius: radius.field,
    borderWidth: 1.5,
  },
  input: { flex: 1, height: '100%' },
  matchHead: { marginTop: space.xl, marginBottom: space.sm },
});
