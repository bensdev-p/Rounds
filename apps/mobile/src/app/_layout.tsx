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
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
            <Stack.Screen name="index" options={{ title: 'Rounds' }} />
            <Stack.Screen name="topics" options={{ title: 'Choose a topic' }} />
            <Stack.Screen name="progress" options={{ title: 'Progress' }} />
            <Stack.Screen name="collection" options={{ title: 'All scripts' }} />
            <Stack.Screen
              name="session/[scriptId]"
              options={{ title: 'Session', gestureEnabled: false }}
            />
            <Stack.Screen name="script/[scriptId]" options={{ title: 'Illness script' }} />
          </Stack>
        </AuthProvider>
      ) : null}
    </View>
  );
}
