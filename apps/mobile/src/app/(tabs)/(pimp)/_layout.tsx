/** Pimp tab: Home and the topic picker (wireframe 03 keeps the tab bar). */
import { Stack } from 'expo-router';
import { useTheme } from '@/theme';

export default function PimpLayout() {
  const { c } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Screen name="index" options={{ title: 'Rounds' }} />
      <Stack.Screen name="topics" options={{ title: 'Choose a topic' }} />
    </Stack>
  );
}
