/**
 * Change rotation, from Home. The same questions as onboarding (wireframe 01:
 * "Change any time"). The script picker is a link from here and still a long
 * press on Pimp me.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { choiceFromProfile, profileFields, RotationForm } from '@/features/onboarding/RotationForm';
import { useProfile } from '@/lib/profile';
import { space } from '@/theme';
import { Button, Link } from '@/ui/controls';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Text';

export default function ChangeRotation() {
  const { profile, update } = useProfile();
  const params = useLocalSearchParams<{ persona?: string }>();
  const [choice, setChoice] = useState(() => choiceFromProfile(profile, new Date()));
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  function save() {
    const year = choice.year ?? profile.year;
    void update(profileFields({ ...choice, year }, new Date()));
    back();
  }

  return (
    <Screen tab footer={<Button label="Save" onPress={save} />}>
      <Link label="Pimp" icon={ChevronLeft} back onPress={back} />
      <Txt variant="h1" accessibilityRole="header" style={styles.title}>
        Change rotation
      </Txt>
      <RotationForm value={choice} onChange={setChoice} />
      <View style={styles.topics}>
        <Link
          label="Choose a topic instead"
          accessibilityHint="Lists every script with your best rung"
          onPress={() =>
            router.replace({
              pathname: '/topics',
              params: params.persona ? { persona: params.persona } : {},
            })
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.md },
  topics: { flexDirection: 'row', marginTop: space.section },
});
