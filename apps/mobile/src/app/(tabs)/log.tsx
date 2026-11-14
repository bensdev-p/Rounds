/**
 * Log tab. An honest empty state until M2.1 builds logging (wireframe 08,
 * mockup log.png). Title and subtitle are the mockup's.
 */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { space } from '@/theme';
import { Link, Panel } from '@/ui/controls';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Text';

export default function Log() {
  return (
    <Screen tab>
      <Txt variant="h1" accessibilityRole="header" style={styles.title}>
        Log a patient
      </Txt>
      <Txt variant="meta" tone="text2" style={styles.sub}>
        Diagnosis only. No names, dates or record numbers.
      </Txt>
      <Panel style={styles.panel}>
        <Txt variant="body">
          Logging patients comes in the next build. Until then, pick a topic on Pimp.
        </Txt>
        <View style={styles.link}>
          <Link label="Choose a topic" onPress={() => router.navigate('/topics')} />
        </View>
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.md },
  sub: { marginTop: 6 },
  panel: { marginTop: space.xxl },
  link: { marginTop: space.md, alignItems: 'flex-start' },
});
