// frontend/src/pages/student/StudentProgramEnrollmentPage.tsx
import { useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { ProgramEnrollmentView } from '../../features/programs/ProgramEnrollmentView';
import { useCancelEnrollment, useMyEnrollments } from '../../hooks/use-programs';

export function StudentProgramEnrollmentPage() {
  const { enrollmentPublicId } = useParams<{ enrollmentPublicId: string }>();
  const { data: mine = [] } = useMyEnrollments();
  const { mutate: cancel, isPending } = useCancelEnrollment();
  const active = mine.find((e) => e.publicId === enrollmentPublicId)?.status === 'ACTIVE';
  return (
    <ProgramEnrollmentView
      enrollmentPublicId={enrollmentPublicId}
      backTo="/dashboard"
      backLabel="Dashboard"
      actions={active && (
        <Button variant="outline" loading={isPending} onClick={() => {
          if (window.confirm('Cancel this program? Sessions not yet taken will be refunded.')) cancel(enrollmentPublicId!);
        }}>Cancel enrollment</Button>
      )}
    />
  );
}
