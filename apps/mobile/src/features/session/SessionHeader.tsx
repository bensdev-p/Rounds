import { X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { IconButton } from '@/ui/controls';
import { Txt } from '@/ui/Text';

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Close, a centred title (persona or script) and an optional clock. */
export function SessionHeader({
  title,
  clockMs,
  onClose,
  closeLabel = 'End session',
}: {
  title: string;
  clockMs?: number;
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
        {clockMs !== undefined && (
          <Txt
            variant="h2"
            tone="text2"
            fontSize={18}
            tabular
            accessibilityLabel={`Time ${formatClock(clockMs)}`}
          >
            {formatClock(clockMs)}
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
