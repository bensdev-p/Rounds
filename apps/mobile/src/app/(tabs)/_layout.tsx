/**
 * The tab shell: Pimp, Log, Review, Profile (DESIGN.md → Layout). Session
 * screens and the illness script sit above this in the root stack, so they
 * hide the tab bar.
 */
import { Tabs } from 'expo-router';
import { TabBar } from '@/ui/TabBar';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="(pimp)" options={{ title: 'Pimp' }} />
      <Tabs.Screen name="log" options={{ title: 'Log' }} />
      <Tabs.Screen name="review" options={{ title: 'Review' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
