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
import { Platform, useColorScheme, type TextStyle } from 'react-native';
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
  // A line shorter than the type (scoreHero: 88 pt type on an 80 pt line) clips
  // the top of the glyphs on iOS; the web lets them overflow. Give iOS the full
  // line and pull the extra back with negative margins, so layout is unchanged.
  const tight = Platform.OS === 'ios' && t.lineHeight < t.size;
  return {
    fontFamily: fonts[t.family],
    fontSize: t.size,
    lineHeight: tight ? t.size : t.lineHeight,
    ...(tight ? { marginVertical: (t.lineHeight - t.size) / 2 } : null),
    ...(t.family === 'display' ? { letterSpacing: -0.2 } : null),
    ...(options.tabular ? { fontVariant: ['tabular-nums'] } : null),
  };
}

export { fonts };
