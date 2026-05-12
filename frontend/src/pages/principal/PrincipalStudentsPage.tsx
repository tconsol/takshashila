import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/shared/PageHeader';
import { StudentCard } from '../../components/shared/StudentCard';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { usePendingStudents, useStudentList, useApproveStudent, useSuspendStudent } from '../../hooks/use-students';
import type { StudentProfile } from '../../services/students.service';
import { useStartConversation } from '../../features/chat/use-chat';

const TABS = [
  { key: 'pending', label: 'Pending Approval' },
  { key: 'all', label: 'All Students' },
];

export function PrincipalStudentsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('pending');
  const [suspendTarget, setSuspendTarget] = useState<StudentProfile | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

  const { data: pending = [], isLoading: pendingLoading } = usePendingStudents();
  const { data: allStudents, isLoading: allLoading } = useStudentList();
  const { mutateAsync: approve } = useApproveStudent();
  const { mutateAsync: suspend, isPending: suspending } = useSuspendStudent();
  const { mutateAsync: startConversation } = useStartConversation();

  const handleMessage = async (student: StudentProfile) => {
    const conv = await startConversation({ recipientPublicId: student.publicId, recipientRole: 'STUDENT' });
    navigate(`/chat/${conv.publicId}`);
  };

  const displayList = activeTab === 'pending' ? pending : (allStudents?.items ?? []);
  const isLoading = activeTab === 'pending' ? pendingLoading : allLoading;

  const handleApprove = async (student: StudentProfile) => {
    await approve(student.publicId);
  };

  const handleSuspend = async () => {
    if (!suspendTarget) return;
    await suspend({ publicId: suspendTarget.publicId, reason: suspendReason });
    setSuspendTarget(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Students" subtitle="Review and manage student accounts" />

      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : displayList.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          {activeTab === 'pending' ? 'No students pending approval' : 'No students found'}
        </div>
      ) : (
        <div className="space-y-3">
          {displayList.map((student) => (
            <StudentCard
              key={student.publicId}
              student={student}
              onApprove={student.status === 'PENDING_APPROVAL' ? handleApprove : undefined}
              onSuspend={student.status === 'ACTIVE' ? (s) => { setSuspendTarget(s); setSuspendReason(''); } : undefined}
              onMessage={student.status === 'ACTIVE' ? handleMessage : undefined}
            />
          ))}
        </div>
      )}

      <Modal
        open={!!suspendTarget}
        onClose={() => setSuspendTarget(null)}
        title="Suspend Student"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSuspendTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleSuspend} loading={suspending} disabled={!suspendReason.trim()}>
              Suspend
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Suspending <strong>{suspendTarget?.displayName}</strong> will block their access.
          </p>
          <Input
            label="Reason"
            placeholder="Reason for suspension…"
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
