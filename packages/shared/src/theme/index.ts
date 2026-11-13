/**
 * Design tokens. Mirrors docs/design/tokens.json exactly (a test checks this),
 * so components never hold raw hex values. See docs/design/DESIGN.md.
 */

export const colors = {
  dark: {
    bg: '#0E1A2E',
    surface: '#16243C',
    surface2: '#1E2F4C',
    line: '#2A3D5E',
    text: '#EEF2F8',
    text2: '#9BAAC2',
    text3: '#6B7D99',
    ceil: '#8FB3E0',
    signal: '#FFB547',
    onSignal: '#0E1A2E',
    pass: '#5CCB8F',
    miss: '#F2766B',
    passSoft: 'rgba(92,203,143,0.14)',
    missSoft: 'rgba(242,118,107,0.14)',
    signalSoft: 'rgba(255,181,71,0.14)',
    ceilSoft: 'rgba(143,179,224,0.12)',
  },
  light: {
    bg: '#F2F5F9',
    surface: '#FFFFFF',
    surface2: '#E7ECF3',
    line: '#D3DBE6',
    text: '#0E1A2E',
    text2: '#4F5E76',
    text3: '#7D8BA1',
    ceil: '#2F5E99',
    signal: '#F5A623',
    onSignal: '#0E1A2E',
    pass: '#1F8F55',
    miss: '#CC4437',
    passSoft: 'rgba(31,143,85,0.12)',
    missSoft: 'rgba(204,68,55,0.10)',
    signalSoft: 'rgba(245,166,35,0.16)',
    ceilSoft: 'rgba(47,94,153,0.10)',
  },
} as const;

export type ColorScheme = keyof typeof colors;
export type ColorToken = keyof (typeof colors)['dark'];
export type Palette = Record<ColorToken, string>;

/** Font family names as registered by @expo-google-fonts. */
export const fonts = {
  display: 'ArchivoNarrow_700Bold',
  displaySemi: 'ArchivoNarrow_600SemiBold',
  body: 'Archivo_400Regular',
  bodyMedium: 'Archivo_500Medium',
  bodySemi: 'Archivo_600SemiBold',
} as const;

export type FontToken = keyof typeof fonts;

export const typeScale = {
  question: { family: 'display', size: 31, lineHeight: 35 },
  h1: { family: 'display', size: 34, lineHeight: 36 },
  h2: { family: 'display', size: 22, lineHeight: 25 },
  h3: { family: 'bodySemi', size: 17, lineHeight: 22 },
  body: { family: 'body', size: 16, lineHeight: 22 },
  meta: { family: 'body', size: 14, lineHeight: 20 },
  small: { family: 'body', size: 13, lineHeight: 18 },
  rungNumber: { family: 'display', size: 22, lineHeight: 22 },
  scoreHero: { family: 'display', size: 88, lineHeight: 80 },
} as const satisfies Record<string, { family: FontToken; size: number; lineHeight: number }>;

export type TypeToken = keyof typeof typeScale;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 26,
  screenX: 20,
} as const;

export const radius = {
  chip: 999,
  button: 999,
  field: 14,
  row: 14,
  list: 18,
  rung: 12,
  panel: 24,
  hero: 28,
} as const;

export const size = {
  buttonHeight: 52,
  heroButtonHeight: 60,
  fieldHeight: 52,
  rung: 44,
  tabBar: 84,
  minTouch: 44,
} as const;

export const motion = {
  rungPassMs: 280,
  rungPassEasing: 'cubic-bezier(0.2, 0.9, 0.3, 1.2)',
  sheetMs: 240,
} as const;

export const tokens = {
  color: colors,
  font: fonts,
  type: typeScale,
  space,
  radius,
  size,
  motion,
} as const;
