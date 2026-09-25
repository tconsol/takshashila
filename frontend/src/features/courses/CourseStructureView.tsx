// frontend/src/features/courses/CourseStructureView.tsx
//
// Page body for one course's nested structure — used by student, parent and tutor pages.
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen } from 'lucide-react';
import type { ReactNode } from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Loading';
import { useCourseStructure } from '../../hooks/use-courses';
import { CourseStructureTree } from './CourseStructureTree';
import { useOpenMaterial } from './useOpenMaterial';
import type { StructureMaterial } from '../../services/courses.service';

export function CourseStructureView({ coursePublicId, backTo, backLabel, renderMaterialExtra }: {
  coursePublicId?: string;
  backTo: string;
  backLabel: string;
  renderMaterialExtra?: (m: StructureMaterial) => ReactNode;
}) {
  const { data, isLoading, isError } = useCourseStructure(coursePublicId);
  const openMaterial = useOpenMaterial(data?.viewerRole ?? 'STUDENT');
  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (isError || !data) {
    return <div className="py-16 text-center text-sm text-gray-500">Course not found. <Link to={backTo} className="text-brand-600 hover:underline">{backLabel}</Link></div>;
  }
  const { course, curriculum, topics, otherClasses, viewerRole } = data;
  const showStatus = viewerRole === 'STUDENT' || viewerRole === 'PARENT';
  const doneTopics = topics.filter((t) => t.status === 'COMPLETED').length;
  const pct = topics.length ? Math.round((doneTopics / topics.length) * 100) : 0;
  const who = viewerRole === 'TUTOR' ? `for ${course.studentName}` : `with ${course.tutorName}`;

  return (
    <div className="animate-fade-in">
      <Link to={backTo} className="mb-3 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
      </Link>
      <PageHeader
        eyebrow="Course"
        title={curriculum.title}
        description={`${curriculum.subject} · ${curriculum.grade}${curriculum.district ? ` · ${curriculum.district}` : ''} · ${who}`}
        icon={<BookOpen className="h-5 w-5" />}
      />
      <Card className="mb-4">
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            {showStatus
              ? <span className="font-medium text-gray-900 dark:text-white">{doneTopics}/{topics.length} topics completed</span>
              : <span className="font-medium text-gray-900 dark:text-white">{topics.length} topics</span>}
            <span className="text-xs text-gray-500">{course.classesCompletedCount}/{course.classesRequired} classes completed</span>
          </div>
          {showStatus && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800" aria-hidden>
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <CourseStructureTree topics={topics} otherClasses={otherClasses} showStatus={showStatus} onOpenMaterial={openMaterial} renderMaterialExtra={renderMaterialExtra} />
        </CardContent>
      </Card>
    </div>
  );
}
