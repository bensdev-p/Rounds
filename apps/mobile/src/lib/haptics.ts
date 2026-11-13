import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Haptics are the only feedback "sound" in the app (DESIGN.md). No-ops where unsupported. */
export function rungPassHaptic(): void {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function promotionHaptic(): void {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}
