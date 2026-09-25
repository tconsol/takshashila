// frontend/src/pages/student/StudentCourseProgressPage.tsx
//
// A student's own course: Course › Topic (status) › classes + materials.
// A topic is done when all its counted classes are COMPLETED (computed server-side
// in server/src/modules/courses/course-progress.ts).
import { useParams } from 'react-router-dom';
import { CourseStructureView } from '../../features/courses/CourseStructureView';

export function StudentCourseProgressPage() {
  const { coursePublicId } = useParams<{ coursePublicId: string }>();
  return <CourseStructureView coursePublicId={coursePublicId} backTo="/dashboard" backLabel="Dashboard" />;
}
