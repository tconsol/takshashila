// frontend/src/features/programs/MyProgramsSection.tsx
import { Link } from 'react-router-dom';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/shared/EmptyState';
import { useMyEnrollments } from '../../hooks/use-programs';
import { categoryLabel } from '../../constants/programs';

export function MyProgramsSection() {
  const { data = [] } = useMyEnrollments();
  const enrollments = data.filter((e) => e.status !== 'CANCELLED');
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>My skill programs</CardTitle>
          <p className="mt-1 text-xs text-gray-500">Extracurricular programs you're taking</p>
        </div>
        <Link to="/dashboard/student/skills" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
          Browse skills <ArrowUpRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {enrollments.length === 0 ? (
          <EmptyState compact icon={<Sparkles className="h-6 w-6" />} title="No skill programs yet"
            description="Explore arts, chess, coding, AI and more."
            action={<Link to="/dashboard/student/skills"><Button size="sm" variant="gradient">Browse skills</Button></Link>} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {enrollments.map((e) => {
              const pct = e.sessionCount ? Math.round((e.sessionsCompletedCount / e.sessionCount) * 100) : 0;
              return (
                <Link key={e.publicId} to={`/dashboard/student/skills/enrollments/${e.publicId}`} className="rounded-xl border border-rule p-4 hover:border-brand-300">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-gray-900 dark:text-white">{e.programTitle}</p>
                    <Badge variant={e.status === 'COMPLETED' ? 'success' : 'purple'} tone="soft">{e.status === 'COMPLETED' ? 'Completed' : categoryLabel(e.programCategory)}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">with {e.tutorName}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800" aria-hidden>
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{e.sessionsCompletedCount}/{e.sessionCount} sessions completed</p>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
