import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ClipboardList, Plus, Calendar } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { ClassCard } from '../../components/shared/ClassCard';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useMyClassesAsTutor, useCompleteClass, useCancelClass } from '../../hooks/use-classes';
import { useMyStudentsAsTutor } from '../../hooks/use-students';
import { WorksheetUploadModal } from '../../features/worksheets/WorksheetUploadModal';
import { TutorRescheduleModal } from '../../features/classes/TutorCreateClassModal';
import type { ClassRecord } from '../../services/classes.service';

const EMPTY_LABELS: Record<string, string> = {
  SCHEDULED: 'No upcoming classes',
  LIVE: 'No classes in progress',
  COMPLETED: 'No completed classes',
  CANCELLED: 'No cancelled classes',
};

export function TutorClassesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('SCHEDULED');
  const [cancelTarget, setCancelTarget] = useState<ClassRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [uploadTarget, setUploadTarget] = useState<ClassRecord | null>(null);
  const [uploadType, setUploadType] = useState<'WORKSHEET' | 'ASSIGNMENT'>('WORKSHEET');
  const [rescheduleTarget, setRescheduleTarget] = useState<ClassRecord | null>(null);

  const { data, isLoading } = useMyClassesAsTutor({ status: activeTab });
  const { data: liveData } = useMyClassesAsTutor({ status: 'LIVE', limit: '1' });
  const hasLive = (liveData?.total ?? 0) > 0;

  const { mutateAsync: completeClass } = useCompleteClass();
  const { mutateAsync: cancelClass, isPending: cancelling } = useCancelClass();

  const { data: studentsData } = useMyStudentsAsTutor({ limit: '200' });
  const studentList = (studentsData?.items ?? [])
    .filter((s) => s.status === 'ACTIVE' || s.status === 'APPROVED')
    .map((s) => ({ publicId: s.publicId, name: s.displayName || `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || 'Student' }));

  const classes = data?.items ?? [];

  const TABS = [
    { key: 'SCHEDULED', label: 'Upcoming' },
    { key: 'LIVE', label: 'In Progress', indicator: hasLive },
    { key: 'COMPLETED', label: 'Completed' },
    { key: 'CANCELLED', label: 'Cancelled' },
  ];

  const handleAction = (action: 'start' | 'complete' | 'cancel' | 'join' | 'rate' | 'reschedule', cls: ClassRecord) => {
    if (action === 'complete') completeClass(cls.publicId);
    else if (action === 'cancel') { setCancelTarget(cls); setCancelReason(''); }
    else if (action === 'reschedule') setRescheduleTarget(cls);
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    await cancelClass({ classId: cancelTarget.publicId, dto: { reason: cancelReason } });
    setCancelTarget(null);
  };

  const openUpload = (cls: ClassRecord, type: 'WORKSHEET' | 'ASSIGNMENT') => {
    setUploadTarget(cls);
    setUploadType(type);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <PageHeader title="My Classes" subtitle="Manage your scheduled and completed sessions" />
        <Button variant="gradient" onClick={() => navigate('/dashboard/tutor/classes/create')} className="shrink-0">
          <Plus className="h-4 w-4" /> Create Class
        </Button>
      </div>

      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          {EMPTY_LABELS[activeTab] ?? 'No classes found'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {classes.map((cls) => (
            <div key={cls.publicId} className="flex flex-col gap-0">
              <ClassCard cls={cls} perspective="tutor" onAction={handleAction} />

              {/* Reschedule button for SCHEDULED classes */}
              {cls.status === 'SCHEDULED' && (
                <div className="flex gap-2 px-5 pb-3 -mt-1 bg-white dark:bg-gray-800 rounded-b-xl border border-t-0 border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setRescheduleTarget(cls)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg py-1.5 transition-colors"
                  >
                    <Calendar className="h-3.5 w-3.5" /> Reschedule
                  </button>
                </div>
              )}

              {/* Worksheet/Assignment buttons for COMPLETED classes */}
              {cls.status === 'COMPLETED' && (
                <div className="flex gap-2 px-5 pb-5 -mt-2 bg-white dark:bg-gray-800 rounded-b-xl border border-t-0 border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => openUpload(cls, 'WORKSHEET')}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg py-1.5 transition-colors"
                  >
                    <BookOpen className="h-3.5 w-3.5" /> Upload Worksheet
                  </button>
                  <button
                    onClick={() => openUpload(cls, 'ASSIGNMENT')}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg py-1.5 transition-colors"
                  >
                    <ClipboardList className="h-3.5 w-3.5" /> Upload Assignment
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Cancel modal */}
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

      {/* Reschedule modal */}
      <TutorRescheduleModal
        cls={rescheduleTarget}
        open={!!rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
      />

      {/* Worksheet / Assignment upload modal */}
      <WorksheetUploadModal
        open={!!uploadTarget}
        onClose={() => setUploadTarget(null)}
        cls={uploadTarget}
        type={uploadType}
        students={studentList}
      />
    </div>
  );
}
