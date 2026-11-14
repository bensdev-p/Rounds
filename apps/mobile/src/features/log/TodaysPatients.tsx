/**
 * Home, "From today's patients" (wireframe 02 note 3, home.png): each of
 * today's logs is a one-tap session on its script, oldest first. A log with no
 * matching script is listed without Start.
 */
import { clockLabel, type PatientLog } from '@rounds/shared';
import { router } from 'expo-router';
import { Chip, Link, List, Row, SectionHead } from '@/ui/controls';
import { Txt } from '@/ui/Text';

export function TodaysPatients({
  logs,
  onStart,
}: {
  logs: readonly PatientLog[];
  onStart: (scriptId: string) => void;
}) {
  return (
    <>
      <SectionHead
        title="From today's patients"
        right={
          <Link
            label="Log one"
            accessibilityHint="Opens the Log tab"
            onPress={() => router.navigate('/log')}
          />
        }
      />
      {logs.length === 0 ? (
        <Txt variant="meta" tone="text2">
          Log a patient to practise on them tonight.
        </Txt>
      ) : (
        <List>
          {logs.map((log, i) => {
            const logged = `Logged ${clockLabel(log.logged_at)}`;
            const scriptId = log.script_id;
            return (
              <Row
                key={log.id}
                first={i === 0}
                title={log.label}
                subtitle={scriptId ? logged : `${logged}  ·  No script yet`}
                trailing={
                  scriptId ? (
                    <Chip
                      role="button"
                      label="Start"
                      accessibilityLabel={`Start a session on ${log.label}`}
                      onPress={() => onStart(scriptId)}
                    />
                  ) : undefined
                }
              />
            );
          })}
        </List>
      )}
    </>
  );
}
