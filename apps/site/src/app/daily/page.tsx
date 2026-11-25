import { Info } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Daily pimp',
  description: 'One script a day, the same for everyone. See how far you get before you’re pimped.',
};

/**
 * The daily pimp's waiting state. The game itself (M4.3 phase 2) uses approved
 * scripts only, and testers until the first script is approved.
 */
export default function Daily() {
  return (
    <section className="section">
      <div className="wrap split top-align">
        <div className="stack-lg">
          <h1 className="t-page">Daily pimp</h1>
          <p className="body t2 measure">
            One script a day, the same for everyone, no account needed. See how far you get before
            you&apos;re pimped.
          </p>
          <div className="info measure">
            <Info aria-hidden="true" />
            <p>
              The daily pimp opens once the first scripts have been reviewed by a physician. Until
              then, testers practise in the app. <Link href="/support">Ask for an invite</Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
