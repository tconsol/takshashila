import { useState } from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { ClassCard } from '../../components/shared/ClassCard';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useMyClassesAsTutor, useStartClass, useCompleteClass, useCancelClass, useSetMeetingUrl } from '../../hooks/use-classes';
import type { ClassRecord } from '../../services/classes.service';

const TABS = [
  { key: 'SCHEDULED', label: 'Upcoming' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

export function TutorClassesPage() {
  const [activeTab, setActiveTab] = useState('SCHEDULED');
  const [cancelTarget, setCancelTarget] = useState<ClassRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [meetingTarget, setMeetingTarget] = useState<ClassRecord | null>(null);
  const [meetingUrl, setMeetingUrl] = useState('');

  const { data, isLoading } = useMyClassesAsTutor({ status: activeTab });
  const { mutateAsync: startClass } = useStartClass();
  const { mutateAsync: completeClass } = useCompleteClass();
  const { mutateAsync: cancelClass, isPending: cancelling } = useCancelClass();
  const { mutateAsync: setUrl, isPending: settingUrl } = useSetMeetingUrl();

  const classes = data?.items ?? [];

  const handleAction = (action: 'start' | 'complete' | 'cancel' | 'join' | 'rate', cls: ClassRecord) => {
    if (action === 'start') startClass(cls.publicId);
    else if (action === 'complete') completeClass(cls.publicId);
    else if (action === 'cancel') { setCancelTarget(cls); setCancelReason(''); }
    else if (action === 'join' && cls.meetingUrl) window.open(cls.meetingUrl, '_blank');
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    await cancelClass({ classId: cancelTarget.publicId, dto: { reason: cancelReason } });
    setCancelTarget(null);
  };

  const handleSetMeetingUrl = async () => {
    if (!meetingTarget) return;
    await setUrl({ classId: meetingTarget.publicId, url: meetingUrl });
    setMeetingTarget(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="My Classes" subtitle="Manage your scheduled and completed sessions" />

      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          No {activeTab.toLowerCase()} classes
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {classes.map((cls) => (
            <div key={cls.publicId} className="space-y-2">
              <ClassCard cls={cls} perspective="tutor" onAction={handleAction} />
              {(cls.status === 'SCHEDULED' || cls.status === 'IN_PROGRESS') && (
                <button
                  onClick={() => { setMeetingTarget(cls); setMeetingUrl(cls.meetingUrl ?? ''); }}
                  className="w-full text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-center"
                >
                  {cls.meetingUrl ? 'Update meeting URL' : '+ Add meeting URL'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel Class"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelTarget(null)}>Back</Button>
            <Button variant="danger" onClick={handleCancel} loading={cancelling} disabled={!cancelReason.trim()}>
              Confirm Cancel
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Please provide a reason for cancelling this class. Your student will be refunded automatically.
          </p>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={3}
            placeholder="Reason for cancellation…"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      </Modal>

      <Modal
        open={!!meetingTarget}
        onClose={() => setMeetingTarget(null)}
        title="Set Meeting URL"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setMeetingTarget(null)}>Cancel</Button>
            <Button onClick={handleSetMeetingUrl} loading={settingUrl} disabled={!meetingUrl.trim()}>Save</Button>
          </>
        }
      >
        <Input
          label="Meeting URL"
          placeholder="https://meet.google.com/…"
          value={meetingUrl}
          onChange={(e) => setMeetingUrl(e.target.value)}
          type="url"
        />
      </Modal>
    </div>
  );
}
