// frontend/src/pages/parent/ParentProgramEnrollmentPage.tsx
import { useParams } from 'react-router-dom';
import { ProgramEnrollmentView } from '../../features/programs/ProgramEnrollmentView';

export function ParentProgramEnrollmentPage() {
  const { enrollmentPublicId } = useParams<{ enrollmentPublicId: string }>();
  return <ProgramEnrollmentView enrollmentPublicId={enrollmentPublicId} backTo="/dashboard/parent/courses" backLabel="Courses" />;
}
