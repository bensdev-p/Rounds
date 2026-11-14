/**
 * Review tab. An honest empty state until M2.2 builds the evening review
 * (wireframe 09, mockups review.png and review-light.png).
 */
import { StyleSheet } from 'react-native';
import { space } from '@/theme';
import { Panel } from '@/ui/controls';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Text';

export default function Review() {
  return (
    <Screen tab>
      <Txt variant="h1" accessibilityRole="header" style={styles.title}>
        {"Tonight's review"}
      </Txt>
      <Panel style={styles.panel}>
        <Txt variant="body">
          {
            "Tonight's review comes in a later build. For now, the result screen links each miss to its script."
          }
        </Txt>
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.md },
  panel: { marginTop: space.xxl },
});
