import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { colors, type ColorToken } from '@rounds/shared/theme';
import { describe, expect, it } from 'vitest';
import { cssVar, motionVars, themeCss } from './theme.ts';

describe('site theme', () => {
  it('names variables the way the mockup CSS does', () => {
    expect(cssVar('surface2')).toBe('--surface-2');
    expect(cssVar('onSignal')).toBe('--on-signal');
    expect(cssVar('passSoft')).toBe('--pass-soft');
  });

  it('defines every token for dark and light', () => {
    const css = themeCss();
    for (const scheme of ['dark', 'light'] as const) {
      for (const token of Object.keys(colors[scheme]) as ColorToken[]) {
        expect(css).toContain(`${cssVar(token)}:${colors[scheme][token]};`);
      }
    }
  });

  it('defines the motion tokens', () => {
    expect(themeCss()).toContain('--rung-pass-ms:280ms;');
  });

  it('uses only variables that come from the tokens, and no raw colours', () => {
    const sheet = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');
    const known = new Set([
      ...(Object.keys(colors.dark) as ColorToken[]).map(cssVar),
      ...Object.keys(motionVars),
    ]);
    const used = new Set(sheet.match(/var\(--[a-z0-9-]+\)/g)?.map((v) => v.slice(4, -1)));
    for (const name of used) expect(known, `${name} is not a token`).toContain(name);
    expect(sheet).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
