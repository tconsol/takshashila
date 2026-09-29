import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  LEGAL_DOCS, LEGAL_EFFECTIVE, LEGAL_VERSION, getLegalDoc,
} from './legal-content';

/** Public page for one legal document: /privacy, /terms, /cookies, /data-policy. */
export function LegalPage({ slug }: { slug?: string }) {
  const params = useParams();
  const doc = getLegalDoc(slug ?? params.slug ?? '');
  if (!doc) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-white text-slate-800 dark:bg-slate-950 dark:text-slate-200">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to brainbaseedu
        </Link>

        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{doc.title}</h1>
        <p className="mt-2 text-sm text-slate-500">
          Version {LEGAL_VERSION} · Effective {LEGAL_EFFECTIVE}
        </p>
        <p className="mt-4 text-base text-slate-600 dark:text-slate-300">{doc.summary}</p>

        <div className="mt-8 space-y-8">
          {doc.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{section.heading}</h2>
              {section.body.map((p) => (
                <p key={p} className="mt-2 text-sm leading-relaxed">{p}</p>
              ))}
              {section.bullets && (
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                  {section.bullets.map((b) => <li key={b}>{b}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>

        <nav className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200 pt-6 text-sm dark:border-slate-800">
          {LEGAL_DOCS.map((d) => (
            <Link key={d.slug} to={`/${d.slug}`} className={`hover:underline ${d.slug === doc.slug ? 'font-semibold text-brand-600' : 'text-slate-500'}`}>
              {d.title}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
