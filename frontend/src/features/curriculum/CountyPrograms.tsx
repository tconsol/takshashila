// frontend/src/features/curriculum/CountyPrograms.tsx
//
// "Programs in your county": extra offerings from the student's county for their grade. Information
// only (no chapters, classes or progress). Shown on the student and parent curriculum pages.
import { MapPin } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { useCountyAdditions } from '../../hooks/use-county-additions';
import { gradeRangeLabel } from '../../services/county-additions.service';
import { ALL_GRADES } from './GradeFilter';

export function CountyPrograms({ stateCode, countyFips, countyName, gradeFilter }: {
  stateCode?: string;
  countyFips?: string;
  countyName?: string;
  /** The grade filter value of the page; 'all' shows every grade. */
  gradeFilter: string;
}) {
  const { data: items = [] } = useCountyAdditions(stateCode, countyFips, gradeFilter === ALL_GRADES ? undefined : gradeFilter);
  if (!stateCode || !countyFips || items.length === 0) return null;

  return (
    <section className="mt-8" aria-label="Programs in your county">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
        <MapPin className="h-4 w-4 text-brand-600" /> Programs in {countyName ?? 'your county'}
      </h2>
      <p className="mb-3 text-xs text-gray-500">Extra programs offered locally, on top of the state curriculum. For information only.</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((a) => (
          <li key={a.publicId} className="rounded-xl border border-rule bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{a.category}{a.subjectName ? ` · ${a.subjectName}` : ''}</span>
              <Badge variant="info" tone="soft">{gradeRangeLabel(a.gradeFrom, a.gradeTo)}</Badge>
            </div>
            {a.district && <p className="mt-0.5 text-xs text-gray-500">{a.district}</p>}
            {a.description && <p className="mt-2 whitespace-pre-line text-xs text-gray-600 dark:text-gray-400">{a.description}</p>}
            {a.topics.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-gray-700 dark:text-gray-300">{a.topics.map((t, i) => <li key={i}>{t}</li>)}</ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
