import type { NextConfig } from 'next';

/** A static site: `next build` writes plain HTML to `out/`, served by Cloudflare Pages. */
const config: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  // @rounds/shared ships TypeScript source (with .ts import extensions).
  transpilePackages: ['@rounds/shared'],
};

export default config;
