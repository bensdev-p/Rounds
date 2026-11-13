import { continueRender, delayRender, staticFile } from 'remotion';
import { fontFiles } from './theme.ts';

let started = false;

/** Loads Archivo and Archivo Narrow, and holds rendering until they're ready. */
export const loadFonts = (): void => {
  if (started || typeof document === 'undefined') return;
  started = true;
  const handle = delayRender('Loading fonts from docs/design/fonts');
  Promise.all(
    fontFiles.map(async ({ family, weight, file }) => {
      const face = new FontFace(family, `url(${staticFile(file)}) format('woff2')`, {
        weight: String(weight),
      });
      document.fonts.add(await face.load());
    }),
  )
    .then(() => continueRender(handle))
    .catch((err: unknown) => {
      throw new Error(`Could not load fonts: ${String(err)}`);
    });
};
