/**
 * App theme. Values come only from the shared tokens (docs/design/tokens.json),
 * never raw hex. Dark is the default (DESIGN.md); light uses the same layouts.
 * Until Settings exists, EXPO_PUBLIC_THEME=light|system overrides the default.
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

export { motion, radius, size, space } from '@rounds/shared/theme';

export interface Theme {
  scheme: ColorScheme;
  c: Palette;
}

type Preference = ColorScheme | 'system';

function preference(): Preference {
  const value = process.env.EXPO_PUBLIC_THEME;
  return value === 'light' || value === 'system' ? value : 'dark';
}

export function useTheme(): Theme {
  const system = useColorScheme();
  const pref = preference();
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
