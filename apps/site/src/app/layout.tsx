import '@fontsource/archivo/400.css';
import '@fontsource/archivo/500.css';
import '@fontsource/archivo/600.css';
import '@fontsource/archivo/700.css';
import '@fontsource/archivo-narrow/700.css';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { colors } from '@rounds/shared/theme';
import { Footer } from '../components/Footer.tsx';
import { Header } from '../components/Header.tsx';
import { site } from '../lib/site.ts';
import { themeCss } from '../lib/theme.ts';

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: 'PimpMe: get pimped here first', template: '%s · PimpMe' },
  description:
    'A pimping trainer for medical students. An AI attending asks out loud, one rung harder each time, until you miss.',
  icons: { icon: '/favicon.png', apple: '/apple-touch-icon.png' },
  openGraph: { siteName: 'PimpMe', type: 'website' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: colors.dark.bg },
    { media: '(prefers-color-scheme: light)', color: colors.light.bg },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
      </head>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
