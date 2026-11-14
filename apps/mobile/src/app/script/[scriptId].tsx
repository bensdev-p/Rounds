/**
 * Illness script, read only. Wireframe 10, mockup script.png. Only approved
 * scripts are visible; the reviewer line is why students can trust it.
 */
import type { IllnessScript } from '@rounds/shared';
import { getLadderContent } from '@rounds/shared/api';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Flag } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Disclaimer } from '@/components/Disclaimer';
import { ErrorView, Loading } from '@/components/StatusView';
import { FlagSheet, type FlagTarget } from '@/features/flag/FlagSheet';
import { useClient } from '@/lib/auth';
import { ROTATION_NAMES } from '@/lib/copy';
import { usePersona } from '@/lib/prefs';
import { useAsync } from '@/lib/useAsync';
import { space, useTheme } from '@/theme';
import { Button, Chip, Link } from '@/ui/controls';
import { LadderIcon } from '@/ui/icons';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Text';
import { loadErrorMessage } from '@/lib/errors';

const join = (items: readonly string[]) => items.join(', ');
const sentence = (text: string) => {
  const t = text.trim();
  const capped = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
};

function sections(s: IllnessScript): { title: string; body: string }[] {
  const findings = [
    ...s.key_findings.history,
    ...s.key_findings.exam,
    ...s.key_findings.labs,
    ...s.key_findings.imaging,
  ];
  return [
    {
      title: 'Who gets it',
      body: [
        sentence(s.epidemiology.who),
        s.epidemiology.risk_factors.length > 0 &&
          `Risk factors: ${sentence(join(s.epidemiology.risk_factors))}`,
      ]
        .filter(Boolean)
        .join(' '),
    },
    { title: 'Key findings', body: sentence(join(findings)) },
    {
      title: 'Diagnosis',
      body: [
        sentence(join(s.diagnosis.confirmatory_tests)),
        s.diagnosis.criteria.length > 0 && sentence(join(s.diagnosis.criteria)),
      ]
        .filter(Boolean)
        .join(' '),
    },
    {
      title: 'Management',
      body: [
        sentence(join(s.management.first_line)),
        s.management.next_line.length > 0 && `Next: ${sentence(join(s.management.next_line))}`,
      ]
        .filter(Boolean)
        .join(' '),
    },
    ...(s.pearls.length > 0 ? [{ title: 'Pearls', body: s.pearls.map(sentence).join(' ') }] : []),
  ].filter((section) => section.body.length > 1);
}

function reviewedLine(s: IllnessScript): string | null {
  if (s.status === 'in_review') {
    return 'Not yet reviewed. Double-check anything that looks off, and flag it below.';
  }
  if (!s.reviewed_by || !s.reviewed_at) return null;
  const date = new Date(s.reviewed_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return `Reviewed by ${s.reviewed_by}, on ${date}`;
}

export default function ScriptScreen() {
  const { c } = useTheme();
  const client = useClient();
  const [persona] = usePersona();
  const { scriptId } = useLocalSearchParams<{ scriptId: string }>();
  const content = useAsync(() => getLadderContent(client, scriptId), scriptId);
  const [flagTarget, setFlagTarget] = useState<FlagTarget | null>(null);

  if (content.status === 'loading') return <Loading label="Loading the script" />;
  if (content.status === 'error') {
    return (
      <ErrorView
        message={loadErrorMessage("Couldn't load this script.", content.error)}
        onRetry={content.reload}
      />
    );
  }
  if (!content.data) return <ErrorView message="That script isn't available." />;
  const { script, confusables } = content.data;
  const reviewed = reviewedLine(script);
  const approvedLinks = script.confused_with.filter((link) =>
    confusables.some((c2) => c2.script_id === link.script_id),
  );

  return (
    <Screen
      footer={
        content.data.questions.length > 0 ? (
          <Button
            label="Pimp me on this"
            icon={LadderIcon}
            onPress={() =>
              router.replace({ pathname: '/session/[scriptId]', params: { scriptId, persona } })
            }
          />
        ) : null
      }
    >
      <Link
        label="Back"
        icon={ChevronLeft}
        back
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
      <Txt variant="h1" accessibilityRole="header" style={styles.title}>
        {script.name}
      </Txt>
      {reviewed && (
        <Txt variant="small" tone="text2" style={styles.reviewed}>
          {reviewed}
        </Txt>
      )}
      <View style={[styles.chips, styles.rotations]}>
        {script.rotation.map((r) => (
          <Chip key={r} label={ROTATION_NAMES[r]} />
        ))}
      </View>

      {sections(script).map((section) => (
        <View key={section.title} style={[styles.block, { borderTopColor: c.line }]}>
          <Txt
            variant="small"
            weight="bodySemi"
            tone="ceil"
            accessibilityRole="header"
          >
            {section.title}
          </Txt>
          <Txt variant="body" fontSize={15} lineHeight={22.5}>
            {section.body}
          </Txt>
        </View>
      ))}

      {approvedLinks.length > 0 && (
        <View style={[styles.block, { borderTopColor: c.line }]}>
          <Txt
            variant="small"
            weight="bodySemi"
            tone="ceil"
            accessibilityRole="header"
          >
            Confused with
          </Txt>
          <View style={[styles.chips, styles.links]}>
            {approvedLinks.map((link) => {
              const name = confusables.find((x) => x.script_id === link.script_id)?.names[0];
              return (
                <Chip
                  key={link.script_id}
                  label={name ?? link.script_id}
                  accessibilityHint="Opens that script"
                  onPress={() =>
                    router.push({
                      pathname: '/script/[scriptId]',
                      params: { scriptId: link.script_id },
                    })
                  }
                />
              );
            })}
          </View>
          {approvedLinks.map((link) => (
            <Txt key={link.script_id} variant="meta" tone="text2" style={styles.tell}>
              {sentence(link.how_to_tell_apart)}
            </Txt>
          ))}
        </View>
      )}

      <View style={[styles.block, { borderTopColor: c.line }]}>
        <Link
          label="This is wrong"
          icon={Flag}
          accessibilityHint="Report a mistake in this script"
          onPress={() =>
            setFlagTarget({
              script: { id: script.id, version: script.version, name: script.name },
              questions: [],
              reasons: ['script_error', 'other'],
            })
          }
        />
      </View>

      <Disclaimer />
      <FlagSheet target={flagTarget} onClose={() => setFlagTarget(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 14 },
  reviewed: { marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rotations: { marginTop: space.md, marginBottom: space.lg },
  links: { marginTop: space.xs },
  block: { borderTopWidth: 1, paddingVertical: space.lg, gap: space.xs },
  tell: { marginTop: 2 },
});
