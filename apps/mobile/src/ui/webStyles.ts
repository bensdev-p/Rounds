import { Platform, type TextStyle } from 'react-native';

/**
 * Text fields show focus with their own border, so drop the browser's ring on web.
 * RN's style types don't include outlineStyle 'none', which react-native-web passes through.
 */
export const noWebOutline: TextStyle | null =
  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;
