import type { ClockReading } from '@rounds/shared';
import { X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { IconButton } from '@/ui/controls';
import { Txt } from '@/ui/Text';

/**
 * Close, a centred title (persona or script) and an optional clock: time left
 * on the question for a timed attending, time since the first question otherwise.
 */
export function SessionHeader({
  title,
  clock,
  onClose,
  closeLabel = 'End session',
}: {
  title: string;
  clock?: Pick<ClockReading, 'mode' | 'text'>;
  onClose: () => void;
  closeLabel?: string;
}) {
  return (
    <View style={styles.row}>
      <IconButton icon={X} label={closeLabel} onPress={onClose} />
      <Txt variant="meta" tone="text2" numberOfLines={1} style={styles.title}>
        {title}
      </Txt>
      <View style={styles.side}>
        {clock !== undefined && (
          <Txt
            variant="h2"
            tone="text2"
            fontSize={18}
            tabular
            accessibilityRole="timer"
            accessibilityLabel={`${clock.mode === 'countdown' ? 'Time left' : 'Time'} ${clock.text}`}
          >
            {clock.text}
          </Txt>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, textAlign: 'center' },
  side: { width: 36, alignItems: 'flex-end' },
});
