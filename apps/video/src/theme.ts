import type { CSSProperties } from 'react';
import tokens from '../../../docs/design/tokens.json';

/** The phone always uses the dark theme (VIDEO.md → Rules). */
export const color = tokens.color.dark;
export const radius = tokens.radius;
export const size = tokens.size;
export const space = tokens.space;
export const motion = tokens.motion;

type FontKey = keyof typeof tokens.font;
type TypeKey = keyof typeof tokens.type;

/** "ArchivoNarrow_700Bold" → { fontFamily: "Archivo Narrow", fontWeight: 700 } */
const parseFont = (name: string): { fontFamily: string; fontWeight: number } => {
  const [family = '', weight = ''] = name.split('_');
  return {
    fontFamily: family.replace(/([a-z])([A-Z])/g, '$1 $2'),
    fontWeight: Number.parseInt(weight, 10),
  };
};

export const font = Object.fromEntries(
  Object.entries(tokens.font).map(([key, name]) => [key, parseFont(name)]),
) as Record<FontKey, { fontFamily: string; fontWeight: number }>;

/** A type style from tokens.json as CSS. */
export const type = (key: TypeKey): CSSProperties => {
  const t = tokens.type[key];
  return {
    ...font[t.family as FontKey],
    fontSize: t.size,
    lineHeight: `${t.lineHeight}px`,
  };
};

/** Numbers use tabular figures (DESIGN.md → Type). */
export const num: CSSProperties = { ...font.display, fontVariantNumeric: 'tabular-nums' };

/** Font files in docs/design/fonts, served as Remotion's public dir. */
export const fontFiles: readonly { family: string; weight: number; file: string }[] = [
  { family: 'Archivo', weight: 400, file: 'archivo-latin-400-normal.woff2' },
  { family: 'Archivo', weight: 500, file: 'archivo-latin-500-normal.woff2' },
  { family: 'Archivo', weight: 600, file: 'archivo-latin-600-normal.woff2' },
  { family: 'Archivo', weight: 700, file: 'archivo-latin-700-normal.woff2' },
  { family: 'Archivo Narrow', weight: 500, file: 'archivo-narrow-latin-500-normal.woff2' },
  { family: 'Archivo Narrow', weight: 600, file: 'archivo-narrow-latin-600-normal.woff2' },
  { family: 'Archivo Narrow', weight: 700, file: 'archivo-narrow-latin-700-normal.woff2' },
];
