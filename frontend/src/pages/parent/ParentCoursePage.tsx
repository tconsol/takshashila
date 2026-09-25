// frontend/src/pages/parent/ParentCoursePage.tsx
//
// A parent's view of one child's course, with the child's progress status.
import { useParams } from 'react-router-dom';
import { CourseStructureView } from '../../features/courses/CourseStructureView';

export function ParentCoursePage() {
  const { coursePublicId } = useParams<{ coursePublicId: string }>();
  return <CourseStructureView coursePublicId={coursePublicId} backTo="/dashboard/parent/courses" backLabel="Courses" />;
}
