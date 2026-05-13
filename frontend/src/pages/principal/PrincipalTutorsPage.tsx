import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/shared/PageHeader';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { usePendingTutors, useTutorSearch, useApproveTutor, useSuspendTutor } from '../../hooks/use-tutors';
import type { TutorProfile } from '../../services/tutors.service';
import { useStartConversation } from '../../features/chat/use-chat';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

const statusVariant: Record<string, BadgeVariant> = {
  ACTIVE: 'success',
  UNDER_VERIFICATION: 'warning',
  REGISTERED: 'info',
  INVITED: 'default',
  SUSPENDED: 'danger',
  INACTIVE: 'default',
};

const TABS = [
  { key: 'pending', label: 'Pending Approval' },
  { key: 'all', label: 'All Tutors' },
];

export function PrincipalTutorsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('pending');
  const [suspendTarget, setSuspendTarget] = useState<TutorProfile | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const { mutateAsync: startConversation } = useStartConversation();

  const handleMessage = async (tutor: TutorProfile) => {
    const conv = await startConversation({ recipientPublicId: tutor.publicId, recipientRole: 'TUTOR' });
    navigate(`/chat/${conv.publicId}`);
  };

  const { data: pendingTutors = [], isLoading: pendingLoading } = usePendingTutors();
  const { data: allTutors, isLoading: allLoading } = useTutorSearch();
  const { mutateAsync: approve, isPending: approving } = useApproveTutor();
  const { mutateAsync: suspend, isPending: suspending } = useSuspendTutor();

  const displayList = activeTab === 'pending' ? pendingTutors : (allTutors?.items ?? []);
  const isLoading = activeTab === 'pending' ? pendingLoading : allLoading;

  const handleApprove = async (tutor: TutorProfile) => {
    await approve(tutor.publicId);
  };

  const handleSuspend = async () => {
    if (!suspendTarget) return;
    await suspend({ publicId: suspendTarget.publicId, reason: suspendReason });
    setSuspendTarget(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tutors"
        subtitle="Review and manage tutor accounts"
      />

      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : displayList.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          {activeTab === 'pending' ? 'No tutors pending approval' : 'No tutors found'}
        </div>
      ) : (
        <div className="space-y-3">
          {displayList.map((tutor) => (
            <TutorRow
              key={tutor.publicId}
              tutor={tutor}
              statusVariant={statusVariant}
              onApprove={tutor.status !== 'ACTIVE' ? () => handleApprove(tutor) : undefined}
              approvingId={approving ? tutor.publicId : null}
              onSuspend={tutor.status === 'ACTIVE' ? () => { setSuspendTarget(tutor); setSuspendReason(''); } : undefined}
              onMessage={() => handleMessage(tutor)}
            />
          ))}
        </div>
      )}

      <Modal
        open={!!suspendTarget}
        onClose={() => setSuspendTarget(null)}
        title="Suspend Tutor"
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
            Suspending <strong>{suspendTarget?.displayName}</strong> will prevent them from accepting new bookings.
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

function TutorRow({
  tutor,
  statusVariant,
  onApprove,
  approvingId,
  onSuspend,
  onMessage,
}: {
  tutor: TutorProfile;
  statusVariant: Record<string, BadgeVariant>;
  onApprove?: () => void;
  approvingId?: string | null;
  onSuspend?: () => void;
  onMessage?: () => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4">
      <Avatar name={tutor.displayName} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-gray-900 dark:text-white">{tutor.displayName}</p>
          <Badge variant={statusVariant[tutor.status] ?? 'default'}>{tutor.status.replace('_', ' ')}</Badge>
          {tutor.isVerified && <Badge variant="success">Verified</Badge>}
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {tutor.subjects.slice(0, 4).map((s) => (
            <span key={s} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded px-2 py-0.5">{s}</span>
          ))}
        </div>
        <div className="flex gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span>★ {tutor.rating.toFixed(1)}</span>
          <span>{tutor.totalStudents} students</span>
          <span>{tutor.totalClassesCompleted} classes</span>
        </div>
      </div>
      <div className="flex gap-2">
        {onMessage && (
          <Button size="sm" variant="outline" onClick={onMessage}>Message</Button>
        )}
        {onApprove && (
          <Button size="sm" onClick={onApprove} loading={approvingId === tutor.publicId}>
            Approve
          </Button>
        )}
        {onSuspend && (
          <Button size="sm" variant="danger" onClick={onSuspend}>Suspend</Button>
        )}
      </div>
    </div>
  );
}
