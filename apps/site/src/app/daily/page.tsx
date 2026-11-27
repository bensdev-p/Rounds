import type { Metadata } from 'next';
import { DailyPimp } from './DailyPimp.tsx';

export const metadata: Metadata = {
  title: 'Daily pimp',
  description: 'One script a day, the same for everyone. See how far you get before you’re pimped.',
};

/**
 * The daily pimp (M4.3 phase 2). Approved scripts only, for everyone; until
 * the first is approved, signed-in testers also get in-review ones and
 * everyone else sees the waiting state. The game runs in the browser.
 */
export default function Daily() {
  return <DailyPimp />;
}
