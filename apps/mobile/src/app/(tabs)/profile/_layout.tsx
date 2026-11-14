/** Profile tab: Progress, the script collection and Settings, all under the tab bar. */
import { Stack } from 'expo-router';
import { useTheme } from '@/theme';

export default function ProfileLayout() {
  const { c } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Screen name="index" options={{ title: 'Progress' }} />
      <Stack.Screen name="collection" options={{ title: 'All scripts' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}
