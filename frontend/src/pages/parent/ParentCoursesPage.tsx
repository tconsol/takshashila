// frontend/src/pages/parent/ParentCoursesPage.tsx
//
// Courses the parent's children are taking, grouped by child.
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Loading';
import { useChildrenCourses } from '../../hooks/use-courses';
import { useChildrenEnrollments } from '../../hooks/use-programs';

export function ParentCoursesPage() {
  const { data: courses = [], isLoading } = useChildrenCourses();
  const { data: programs = [] } = useChildrenEnrollments();
  const byChild = new Map<string, typeof courses>();
  for (const c of courses) byChild.set(c.studentName ?? 'Child', [...(byChild.get(c.studentName ?? 'Child') ?? []), c]);

  return (
    <div className="animate-fade-in">
      <PageHeader eyebrow="Family" title="Courses" description="Courses your children are taking" icon={<BookOpen className="h-5 w-5" />} />
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : courses.length === 0 && programs.length === 0 ? (
        <Card><CardContent><p className="py-10 text-center text-sm text-gray-500">No courses yet.</p></CardContent></Card>
      ) : (
        <div className="space-y-6">
          {[...byChild.entries()].map(([child, list]) => (
            <section key={child}>
              <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">{child}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((c) => {
                  const total = c.classesRequired ?? 0;
                  const pct = total > 0 ? Math.min(100, Math.round((c.classesCompletedCount / total) * 100)) : 0;
                  return (
                    <Link key={c.publicId} to={`/dashboard/parent/courses/${c.publicId}`} className="rounded-xl border border-rule p-4 hover:border-brand-300">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-gray-900 dark:text-white">{c.curriculumTitle ?? 'Course'}</p>
                        <Badge variant={c.status === 'COMPLETED' ? 'success' : 'info'} tone="soft">{c.status === 'COMPLETED' ? 'Completed' : 'Active'}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">with {c.tutorName ?? 'tutor'}</p>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800" aria-hidden>
                        <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{c.classesCompletedCount}/{total} classes completed</p>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      {programs.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Skill programs</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {programs.map((e) => (
              <Link key={e.publicId} to={`/dashboard/parent/programs/${e.publicId}`} className="rounded-xl border border-rule p-4 hover:border-brand-300">
                <p className="font-semibold text-gray-900 dark:text-white">{e.programTitle}</p>
                <p className="mt-0.5 text-xs text-gray-500">{e.studentName} · with {e.tutorName}</p>
                <p className="mt-1 text-xs text-gray-500">{e.sessionsCompletedCount}/{e.sessionCount} sessions completed</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
