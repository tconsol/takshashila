// frontend/src/pages/student/StudentProgramEnrollmentPage.tsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ProgramEnrollmentView } from '../../features/programs/ProgramEnrollmentView';
import { useCancelEnrollment, useMyEnrollments } from '../../hooks/use-programs';

export function StudentProgramEnrollmentPage() {
  const { enrollmentPublicId } = useParams<{ enrollmentPublicId: string }>();
  const { data: mine = [] } = useMyEnrollments();
  const { mutate: cancel, isPending } = useCancelEnrollment();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const active = mine.find((e) => e.publicId === enrollmentPublicId)?.status === 'ACTIVE';
  return (
    <>
      <ProgramEnrollmentView
        enrollmentPublicId={enrollmentPublicId}
        backTo="/dashboard/student/skills"
        backLabel="Skills"
        actions={active && (
          <Button variant="outline" loading={isPending} onClick={() => setConfirmOpen(true)}>Cancel enrollment</Button>
        )}
      />
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Cancel enrollment"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Keep enrollment</Button>
            <Button
              variant="danger"
              loading={isPending}
              onClick={() => cancel(enrollmentPublicId!, { onSettled: () => setConfirmOpen(false) })}
            >
              Cancel enrollment
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">Cancel this program? Sessions not yet taken are simply not charged, and the credits on hold are released.</p>
      </Modal>
    </>
  );
}
