// iOS/Android: Supabase's recommended setup for Expo.
// https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native
import 'react-native-url-polyfill/auto';
import 'expo-sqlite/localStorage/install';

export const authStorage = globalThis.localStorage;
