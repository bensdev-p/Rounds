import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

/**
 * Privacy policy and Terms: a contents list beside the text (hidden at phone width).
 * The note says the text is a draft until the developer has had it reviewed.
 */
export function LegalDoc({
  title,
  updated,
  note,
  sections,
}: {
  title: string;
  updated: string;
  note: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <section className="section">
      <div className="wrap">
        <div className="doc">
          <nav className="hide-phone" aria-label="Contents">
            <ul className="toc">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.title}</a>
                </li>
              ))}
            </ul>
          </nav>
          <article className="prose">
            <h1 className="t-page">{title}</h1>
            <p className="meta mt12">Last updated {updated}</p>
            <div className="placeholder-note mt26">
              <Info aria-hidden="true" />
              <p>{note}</p>
            </div>
            <div className="mt40">
              {sections.map((s) => (
                <div key={s.id}>
                  <h2 id={s.id}>{s.title}</h2>
                  {s.body}
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
