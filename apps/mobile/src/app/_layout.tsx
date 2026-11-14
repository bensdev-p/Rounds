import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
} from '@expo-google-fonts/archivo';
import {
  ArchivoNarrow_600SemiBold,
  ArchivoNarrow_700Bold,
} from '@expo-google-fonts/archivo-narrow';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { AuthProvider } from '@/lib/auth';
import { ProfileProvider } from '@/lib/profile';
import { useTheme } from '@/theme';

export default function RootLayout() {
  const { c, scheme } = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    ArchivoNarrow_600SemiBold,
    ArchivoNarrow_700Bold,
  });

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {/* On a font error, carry on with system fonts rather than a blank screen. */}
      {fontsLoaded || fontError ? (
        <AuthProvider>
          {/* No profile yet: onboarding (wireframe 01) shows instead of the app. */}
          <ProfileProvider>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
              {/* The four tabs. Screens below cover the tab bar (session screens hide it). */}
              <Stack.Screen name="(tabs)" options={{ title: 'Rounds' }} />
              <Stack.Screen
                name="session/[scriptId]"
                options={{ title: 'Session', gestureEnabled: false }}
              />
              <Stack.Screen name="script/[scriptId]" options={{ title: 'Illness script' }} />
              <Stack.Screen
                name="drill"
                options={{ title: 'Mix-up drill', gestureEnabled: false }}
              />
            </Stack>
          </ProfileProvider>
        </AuthProvider>
      ) : null}
    </View>
  );
}
