// frontend/src/pages/tutor/TutorProgramEnrollmentPage.tsx
import { useParams } from 'react-router-dom';
import { ProgramEnrollmentView } from '../../features/programs/ProgramEnrollmentView';

export function TutorProgramEnrollmentPage() {
  const { enrollmentPublicId } = useParams<{ enrollmentPublicId: string }>();
  return <ProgramEnrollmentView enrollmentPublicId={enrollmentPublicId} backTo="/dashboard/tutor/programs" backLabel="Skill Programs" />;
}
