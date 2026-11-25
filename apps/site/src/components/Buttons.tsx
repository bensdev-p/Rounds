import { Smartphone } from 'lucide-react';
import Link from 'next/link';
import { site } from '../lib/site.ts';
import { Hand } from './Brand.tsx';

/** "Pimp me" and "Join the iPhone beta", with the line under them. */
export function GetStarted({ beta = true, note = true }: { beta?: boolean; note?: boolean }) {
  return (
    <>
      <div className="btns">
        <Link className="btn btn-primary" href={site.webApp}>
          <Hand strokeWidth={2.2} />
          Pimp me
        </Link>
        {beta ? (
          <Link className="btn btn-quiet" href={site.iphoneBeta}>
            <Smartphone aria-hidden="true" />
            Join the iPhone beta
          </Link>
        ) : null}
      </div>
      {note ? <p className="small">{site.ctaNote}</p> : null}
    </>
  );
}
