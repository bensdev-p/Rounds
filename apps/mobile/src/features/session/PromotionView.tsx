/**
 * Promotion. Wireframe 14, mockup promo.png. The only full-screen celebration,
 * once per rank. The new step rises into place (400 ms) with a success haptic.
 */
import type { RankStatus } from '@rounds/shared';
import { X } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { promotionHaptic } from '@/lib/haptics';
import { space } from '@/theme';
import { Button, IconButton } from '@/ui/controls';
import { RankTrack } from '@/ui/progress';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Text';

export function PromotionView({
  rank,
  since,
  personaLine,
  personaName,
  onDone,
}: {
  rank: RankStatus;
  /** Month the student started, e.g. "September". */
  since: string;
  personaLine: string;
  personaName: string;
  onDone: () => void;
}) {
  useEffect(() => {
    promotionHaptic();
  }, []);

  const total = rank.totalRungs.toLocaleString('en-US');
  const next = rank.next
    ? ` ${rank.next.title} is at ${rank.next.min.toLocaleString('en-US')}.`
    : " That's the top rank.";

  return (
    <Screen footer={<Button label="Back to rounds" onPress={onDone} />}>
      <View style={styles.close}>
        <IconButton icon={X} label="Back to rounds" onPress={onDone} />
      </View>
      <View style={styles.body}>
        <View style={styles.track}>
          <RankTrack index={rank.index} rise height={78} min={18} />
        </View>
        <Txt variant="meta" tone="text2" style={styles.promoted}>
          Promoted
        </Txt>
        <Txt variant="h1" fontSize={64} lineHeight={61} accessibilityRole="header" style={styles.title}>
          {rank.title}
        </Txt>
        <Txt variant="body" tone="text2" lineHeight={22} style={styles.detail}>
          {total} rungs climbed since {since}.{next}
        </Txt>
        <Txt variant="body" lineHeight={22} style={styles.quote}>
          {`"${personaLine}"`}
        </Txt>
        <Txt variant="small" tone="text2">
          The {personaName}
        </Txt>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  close: { alignItems: 'flex-end' },
  // The mockup's side margin is 28; Screen gives 20.
  body: { marginHorizontal: space.sm },
  track: { marginTop: 150 },
  promoted: { marginTop: 34 },
  title: { marginTop: 6 },
  detail: { marginTop: 18 },
  quote: { marginTop: 22, marginBottom: 4 },
});
