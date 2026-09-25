// frontend/src/pages/tutor/TutorCoursePage.tsx
//
// A tutor's view of one course they teach (no progress status).
import { useParams } from 'react-router-dom';
import { CourseStructureView } from '../../features/courses/CourseStructureView';

export function TutorCoursePage() {
  const { coursePublicId } = useParams<{ coursePublicId: string }>();
  return <CourseStructureView coursePublicId={coursePublicId} backTo="/dashboard/tutor/course-requests" backLabel="Course requests" />;
}
