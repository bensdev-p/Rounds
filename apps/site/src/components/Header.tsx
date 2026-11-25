'use client';

import { Menu, Monitor, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { nav, site } from '../lib/site.ts';
import { Logo } from './Brand.tsx';

const menu = [
  ...nav,
  { href: '/daily', label: 'Daily pimp' },
  { href: site.webApp, label: 'Open the web app' },
];

export function Header() {
  const path = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  // The menu closes on navigation: it is only open for the page it was opened on.
  const open = openOn === path;
  const current = (href: string) => path === href || path === `${href}/`;

  return (
    <header className="top-bar">
      <div className="wrap top">
        <Logo />
        <nav className="nav" aria-label="Main">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={current(item.href) ? 'on' : undefined}
              aria-current={current(item.href) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link className="btn btn-quiet btn-sm btn-open" href={site.webApp}>
          <Monitor aria-hidden="true" />
          Open the web app
        </Link>
        <button
          type="button"
          className="btn btn-quiet btn-sm menu"
          aria-expanded={open}
          aria-controls="site-menu"
          onClick={() => setOpenOn(open ? null : path)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          {open ? 'Close' : 'Menu'}
        </button>
      </div>
      {open ? (
        <nav id="site-menu" className="sheet" aria-label="Menu">
          <ul className="wrap">
            {menu.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={current(item.href) ? 'on' : undefined}
                  onClick={() => setOpenOn(null)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
