// frontend/src/pages/student/StudentProgramPage.tsx
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { useProgram, useEnroll, useMyEnrollments } from '../../hooks/use-programs';
import { categoryLabel, levelLabel } from '../../constants/programs';
import { formatCurrency } from '../../utils/currency';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function StudentProgramPage() {
  const { programPublicId } = useParams<{ programPublicId: string }>();
  const navigate = useNavigate();
  const { data: program, isLoading } = useProgram(programPublicId);
  const { data: mine = [] } = useMyEnrollments();
  const { mutate: enroll, isPending } = useEnroll();
  const [days, setDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [startLocalTime, setStart] = useState('16:00');
  const [endLocalTime, setEnd] = useState('19:00');

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!program) return <div className="py-16 text-center text-sm text-gray-500">Program not found.</div>;
  const active = mine.find((e) => e.programPublicId === program.publicId && e.status === 'ACTIVE');
  const toggle = (d: number) => setDays((s) => { const n = new Set(s); n.has(d) ? n.delete(d) : n.add(d); return n; });

  return (
    <div className="animate-fade-in">
      <Link to="/dashboard/student/skills" className="mb-3 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-3.5 w-3.5" /> Skills
      </Link>
      <PageHeader eyebrow={categoryLabel(program.category)} title={program.title}
        description={`with ${program.tutorName} · ${levelLabel(program.level)} · ${program.sessionCount} × ${program.sessionMinutes} min`}
        icon={<Sparkles className="h-5 w-5" />} />
      <Card className="mb-4">
        <CardContent className="space-y-3">
          {program.description && <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{program.description}</p>}
          <div>
            <p className="mb-1.5 text-sm font-semibold">What you'll cover</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
              {[...program.modules].sort((a, b) => a.order - b.order).map((m) => <li key={m.publicId}>{m.title}</li>)}
            </ol>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3">
          {active ? (
            <p className="text-sm">You're enrolled. <Link to={`/dashboard/student/skills/enrollments/${active.publicId}`} className="text-brand-600 hover:underline">Open your program</Link></p>
          ) : program.isFull ? (
            <Badge variant="warning" tone="soft">This program is full</Badge>
          ) : (
            <>
              <p className="text-sm font-semibold">When are you free?</p>
              <div className="flex gap-1.5">
                {DAY_LABELS.map((label, i) => (
                  <button key={label} type="button" onClick={() => toggle(i)}
                    className={`h-8 w-10 rounded-lg text-xs font-medium ${days.has(i) ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input type="time" value={startLocalTime} onChange={(e) => setStart(e.target.value)} className="rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1.5 text-sm bg-white dark:bg-gray-900" />
                <span className="text-xs text-gray-400">to</span>
                <input type="time" value={endLocalTime} onChange={(e) => setEnd(e.target.value)} className="rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1.5 text-sm bg-white dark:bg-gray-900" />
              </div>
              <Button variant="gradient" loading={isPending} disabled={days.size === 0}
                onClick={() => enroll(
                  { id: program.publicId, availabilityWindow: { daysOfWeek: [...days], startLocalTime, endLocalTime, ianaTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone } },
                  { onSuccess: (e) => navigate(`/dashboard/student/skills/enrollments/${e.publicId}`) },
                )}>
                Enroll · {formatCurrency(program.priceCents)}
              </Button>
              <p className="text-xs text-gray-500">The full price is charged from your wallet now. Sessions you don't take are refunded if you cancel.</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
