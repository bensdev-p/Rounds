import Link from 'next/link';
import { site } from '../lib/site.ts';
import { Logo } from './Brand.tsx';

const columns = [
  {
    title: 'PimpMe',
    links: [
      { href: '/how-it-works', label: 'How it works' },
      { href: '/anki', label: 'Anki add-on' },
      { href: '/daily', label: 'Daily pimp' },
      { href: site.webApp, label: 'Open the web app' },
    ],
  },
  {
    title: 'Help',
    links: [
      { href: '/faq', label: 'FAQ' },
      { href: '/support', label: 'Support' },
      { href: '/support#feedback', label: 'Send feedback' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy policy' },
      { href: '/terms', label: 'Terms' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <Logo />
            <p className="meta mt12" style={{ maxWidth: 300 }}>
              Get pimped here first.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h2>{col.title}</h2>
              <ul>
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="foot-base">
          <span>
            <b>Educational use only, not clinical guidance.</b> Never enter patient details.
          </span>
          <span>© 2026 PimpMe · {site.domain}</span>
        </div>
      </div>
    </footer>
  );
}
