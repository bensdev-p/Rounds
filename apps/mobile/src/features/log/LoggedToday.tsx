/**
 * "Logged today" on the Log tab (wireframe 08 note 2, log.png): newest first,
 * a dot that is pass (pimped today) or signal (not yet), and the status.
 */
import { logStatus, type PatientLog, type SessionRecord } from '@rounds/shared';
import { StyleSheet, View } from 'react-native';
import { space, useTheme } from '@/theme';
import { List } from '@/ui/controls';
import { Txt } from '@/ui/Text';

export function LoggedToday({
  logs,
  sessions,
  now,
}: {
  logs: readonly PatientLog[];
  sessions: readonly SessionRecord[];
  now: Date;
}) {
  const { c } = useTheme();
  if (logs.length === 0) {
    return (
      <Txt variant="meta" tone="text2">
        Log a patient to practise on them tonight.
      </Txt>
    );
  }
  return (
    <List>
      {[...logs].reverse().map((log, i) => {
        const status = logStatus(log.script_id, sessions, now);
        const dot = status.tone === 'none' ? c.text3 : c[status.tone];
        return (
          <View
            key={log.id}
            accessible
            accessibilityLabel={`${log.label}, ${status.label}`}
            style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}
          >
            <View style={[styles.dot, { backgroundColor: dot }]} />
            <Txt variant="body" weight="bodyMedium" style={styles.label}>
              {log.label}
            </Txt>
            <Txt variant="small" tone="text2">
              {status.label}
            </Txt>
          </View>
        );
      })}
    </List>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { flex: 1, minWidth: 0 },
});
