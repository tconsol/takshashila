// frontend/src/pages/student/StudentCoursesPage.tsx
//
// county/grade live on the Student PROFILE (server/src/modules/students/student.model.ts),
// not on the User/auth object, so this reads them via the existing
// `useMyStudentProfile()` hook (frontend/src/hooks/use-students.ts) — the
// same hook every other Student page already uses for profile data — rather
// than `useAuthStore`, which has no `grade`/`county` fields.
import { Link } from 'react-router-dom';
import { BookOpen, ArrowRight, Inbox } from 'lucide-react';
import { useMyStudentProfile } from '../../hooks/use-students';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Loading';
import { useCourseCatalog } from '../../hooks/use-courses';

export function StudentCoursesPage() {
  const { data: profile, isLoading: profileLoading } = useMyStudentProfile();
  const county = profile?.county;
  const grade = profile?.grade;
  const { data: courses, isLoading } = useCourseCatalog({ county, grade });

  if (profileLoading) {
    return <div className="flex justify-center py-16"><Spinner /></div>;
  }

  if (!county || !grade) {
    return (
      <div className="animate-fade-in">
        <PageHeader eyebrow="Courses" title="Curriculum" icon={<BookOpen className="h-5 w-5" />} />
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-14 text-center gap-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Set your grade and county in your profile to see your curriculum.
              </p>
              <Link to="/profile" className="text-sm text-brand-600 hover:underline">
                Go to profile <ArrowRight className="inline h-3.5 w-3.5" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Courses"
        title="Curriculum"
        description={`${grade} curriculum for ${county}`}
        icon={<BookOpen className="h-5 w-5" />}
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : !courses || courses.length === 0 ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-14 text-center gap-3">
              <Inbox className="h-6 w-6 text-gray-400" />
              <p className="text-sm text-gray-500">No published curriculum yet for {grade} in {county}.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Link key={course.publicId} to={`/dashboard/student/courses/${course.publicId}`}>
              <Card className="h-full hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
                <CardContent>
                  <Badge variant="info" tone="soft">{course.subject}</Badge>
                  <p className="mt-2 font-semibold text-gray-900 dark:text-white">{course.title}</p>
                  <p className="mt-1 text-xs text-gray-500">{course.topics.length} topics</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
