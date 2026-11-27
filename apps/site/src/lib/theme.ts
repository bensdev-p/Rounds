import { colors, motion, type ColorToken, type Palette } from '@rounds/shared/theme';

/** CSS custom property name for a colour token: surface2 → --surface-2, onSignal → --on-signal. */
export function cssVar(token: ColorToken): string {
  return (
    '--' +
    token
      .replace(/([A-Z])/g, '-$1')
      .replace(/(\d)/g, '-$1')
      .toLowerCase()
  );
}

function declarations(palette: Palette): string {
  return (Object.keys(palette) as ColorToken[]).map((t) => `${cssVar(t)}:${palette[t]};`).join('');
}

/** Motion tokens: the rung pass (DESIGN.md → Motion). */
export const motionVars = {
  '--rung-pass-ms': `${motion.rungPassMs}ms`,
  '--rung-pass-ease': motion.rungPassEasing,
} as const;
const motionDeclarations = Object.entries(motionVars)
  .map(([k, v]) => `${k}:${v};`)
  .join('');

/**
 * The site's colours, straight from the shared tokens (docs/design/tokens.json).
 * Dark is the default; light follows the visitor's system setting.
 */
export function themeCss(): string {
  return (
    `:root{color-scheme:dark;${declarations(colors.dark)}${motionDeclarations}}` +
    `@media (prefers-color-scheme: light){:root{color-scheme:light;${declarations(colors.light)}}}`
  );
}
