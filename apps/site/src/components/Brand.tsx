import Link from 'next/link';

/** Lucide's `hand`, the PimpMe mark (DESIGN.md → Brand). */
export function Hand({ strokeWidth = 2.4 }: { strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
      <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" />
      <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
  );
}

/** The lockup: amber tile with the hand, then the wordmark "pimp me." */
export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="PimpMe home">
      <span className="mk">
        <Hand />
      </span>
      <span className="wm" aria-hidden="true">
        pimp me<i>.</i>
      </span>
    </Link>
  );
}
