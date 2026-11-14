/**
 * App theme. Values come only from the shared tokens (docs/design/tokens.json),
 * never raw hex. Dark is the default (DESIGN.md); light uses the same layouts.
 * Settings → Appearance switches it per device (Light, Dark, System).
 */
import {
  colors,
  fonts,
  typeScale,
  type ColorScheme,
  type Palette,
  type TypeToken,
} from '@rounds/shared/theme';
import { useColorScheme, type TextStyle } from 'react-native';
import { useAppearance } from '@/lib/prefs';

export { motion, radius, size, space } from '@rounds/shared/theme';

export interface Theme {
  scheme: ColorScheme;
  c: Palette;
}

export function useTheme(): Theme {
  const system = useColorScheme();
  const [pref] = useAppearance();
  const scheme: ColorScheme = pref === 'system' ? (system === 'light' ? 'light' : 'dark') : pref;
  return { scheme, c: colors[scheme] };
}

/** Font family, size and line height for a type style. Numbers use tabular figures. */
export function type(token: TypeToken, options: { tabular?: boolean | undefined } = {}): TextStyle {
  const t = typeScale[token];
  return {
    fontFamily: fonts[t.family],
    fontSize: t.size,
    lineHeight: t.lineHeight,
    ...(t.family === 'display' ? { letterSpacing: -0.2 } : null),
    ...(options.tabular ? { fontVariant: ['tabular-nums'] } : null),
  };
}

export { fonts };
