// frontend/src/features/courses/MyCoursesSection.tsx
//
// Student dashboard: courses the student built from a curriculum (accepted or
// completed). Each card opens the nested progress page.
import { Link } from 'react-router-dom';
import { ArrowUpRight, GraduationCap } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { EmptyState } from '../../components/shared/EmptyState';
import { useMyCourses } from '../../hooks/use-courses';

export function MyCoursesSection() {
  const { data, isLoading } = useMyCourses({ status: 'ACCEPTED,COMPLETED', limit: '12' });
  const courses = data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>My courses</CardTitle>
          <p className="mt-1 text-xs text-gray-500">Courses you're taking</p>
        </div>
        <Link to="/dashboard/student/curriculum" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
          Browse curriculum <ArrowUpRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : courses.length === 0 ? (
          <EmptyState
            compact
            icon={<GraduationCap className="h-6 w-6" />}
            title="No courses yet"
            description="Pick topics from your curriculum, choose a tutor and send them your course."
            action={
              <Link to="/dashboard/student/curriculum">
                <Button size="sm" variant="gradient">Browse the curriculum</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((req) => {
              const total = req.classesRequired ?? 0;
              const done = req.classesCompletedCount;
              const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
              return (
                <Link
                  key={req.publicId}
                  to={`/dashboard/student/courses/${req.publicId}`}
                  className="rounded-xl border border-rule p-4 transition-colors hover:border-brand-300 dark:hover:border-brand-700"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-gray-900 dark:text-white">{req.curriculumTitle ?? 'Course'}</p>
                    {req.status === 'COMPLETED'
                      ? <Badge variant="success" tone="soft">Completed</Badge>
                      : <Badge variant="info" tone="soft">Active</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">with {req.tutorName ?? 'your tutor'}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800" aria-hidden>
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{done}/{total} classes completed</p>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
