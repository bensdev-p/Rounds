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
      <View style={styles.track}>
        <RankTrack index={rank.index} rise height={150} />
      </View>
      <Txt variant="meta" tone="text2" fontSize={17} style={styles.promoted}>
        Promoted
      </Txt>
      <Txt variant="h1" fontSize={64} lineHeight={66} accessibilityRole="header">
        {rank.title}
      </Txt>
      <Txt variant="body" tone="text2" fontSize={18} lineHeight={26} style={styles.detail}>
        {total} rungs climbed since {since}.{next}
      </Txt>
      <Txt variant="body" fontSize={18} lineHeight={26} style={styles.quote}>
        {`"${personaLine}"`}
      </Txt>
      <Txt variant="meta" tone="text2" fontSize={15}>
        The {personaName}
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  close: { alignItems: 'flex-end' },
  track: { marginTop: space.section * 3 },
  promoted: { marginTop: space.section * 2 },
  detail: { marginTop: space.lg },
  quote: { marginTop: space.xxl, marginBottom: 4 },
});
