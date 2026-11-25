/**
 * Where the site's buttons go. The web app (app.pimpme.app) arrives in M4.4 and a public
 * TestFlight link in M4.6. Until then both point at Support, where testers ask for an
 * invite (developer's decision, 25 Nov 2026). Change them here when those land.
 */
export const site = {
  domain: 'pimpme.app',
  url: 'https://pimpme.app',
  supportEmail: 'support@pimpme.app',
  webApp: '/support',
  iphoneBeta: '/support',
  /** The small line under "Pimp me" and "Join the iPhone beta". */
  ctaNote:
    'PimpMe is in testing with a small group of students. Ask for an invite through Support.',
  addonFile: '/pimpme.ankiaddon',
} as const;

export const nav = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/anki', label: 'Anki' },
  { href: '/faq', label: 'FAQ' },
  { href: '/support', label: 'Support' },
] as const;
