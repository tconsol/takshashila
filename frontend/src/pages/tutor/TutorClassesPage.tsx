import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ClipboardList, Plus, Calendar, RotateCcw } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { ClassCard } from '../../components/shared/ClassCard';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { useMyClassesAsTutor, useCompleteClass, useCancelClass, useRefundClass } from '../../hooks/use-classes';
import { useMyStudentsAsTutor } from '../../hooks/use-students';
import { useTabActivity } from '../../hooks/use-tab-activity';
import { WorksheetUploadModal } from '../../features/worksheets/WorksheetUploadModal';
import { TutorRescheduleModal } from '../../features/classes/TutorCreateClassModal';
import type { ClassRecord } from '../../services/classes.service';

const EMPTY_LABELS: Record<string, string> = {
  ALL: 'No classes yet',
  SCHEDULED: 'No upcoming classes',
  LIVE: 'No classes in progress',
  COMPLETED: 'No completed classes',
  CANCELLED: 'No cancelled classes',
};

const STATUS_VARIANT: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  COMPLETED: 'success',
  CANCELLED: 'danger',
  LIVE: 'warning',
  SCHEDULED: 'info',
};

export function TutorClassesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('ALL');
  const [cancelTarget, setCancelTarget] = useState<ClassRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [refundTarget, setRefundTarget] = useState<ClassRecord | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [uploadTarget, setUploadTarget] = useState<ClassRecord | null>(null);
  const [uploadType, setUploadType] = useState<'WORKSHEET' | 'ASSIGNMENT'>('WORKSHEET');
  const [rescheduleTarget, setRescheduleTarget] = useState<ClassRecord | null>(null);

  // "ALL" tab fetches every status; others filter by the tab.
  const { data, isLoading } = useMyClassesAsTutor(activeTab === 'ALL' ? { limit: '100' } : { status: activeTab });
  const { data: liveData } = useMyClassesAsTutor({ status: 'LIVE', limit: '1' });
  const hasLive = (liveData?.total ?? 0) > 0;

  // Lightweight counts per status (independent of the active tab) so a status
  // change — e.g. a class moving into Completed — lights up that tab even
  // while viewing a different one.
  const { data: scheduledCount } = useMyClassesAsTutor({ status: 'SCHEDULED', limit: '1' });
  const { data: completedCount } = useMyClassesAsTutor({ status: 'COMPLETED', limit: '1' });
  const { data: cancelledCount } = useMyClassesAsTutor({ status: 'CANCELLED', limit: '1' });
  const { dirty, markSeen } = useTabActivity(
    { SCHEDULED: scheduledCount?.total, COMPLETED: completedCount?.total, CANCELLED: cancelledCount?.total },
    activeTab,
  );

  const { mutateAsync: completeClass } = useCompleteClass();
  const { mutateAsync: cancelClass, isPending: cancelling } = useCancelClass();
  const { mutateAsync: refundClass, isPending: refunding } = useRefundClass();

  const handleRefund = async () => {
    if (!refundTarget) return;
    await refundClass({ classId: refundTarget.publicId, reason: refundReason });
    setRefundTarget(null);
    setRefundReason('');
  };

  const { data: studentsData } = useMyStudentsAsTutor({ limit: '200' });
  const studentList = (studentsData?.items ?? [])
    .filter((s) => s.status === 'ACTIVE' || s.status === 'APPROVED')
    .map((s) => ({ publicId: s.publicId, name: s.displayName || `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || 'Student' }));

  const classes = (data?.items ?? []).slice().sort(
    (a, b) => new Date(b.scheduledStartUTC).getTime() - new Date(a.scheduledStartUTC).getTime(),
  ); // newest → oldest

  const TABS = [
    { key: 'ALL', label: 'All' },
    { key: 'SCHEDULED', label: 'Upcoming', indicator: dirty.has('SCHEDULED') },
    { key: 'LIVE', label: 'In Progress', indicator: hasLive },
    { key: 'COMPLETED', label: 'Completed', indicator: dirty.has('COMPLETED') },
    { key: 'CANCELLED', label: 'Cancelled', indicator: dirty.has('CANCELLED') },
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

      <Tabs tabs={TABS} activeTab={activeTab} onChange={(key) => { setActiveTab(key); markSeen(key); }} />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          {EMPTY_LABELS[activeTab] ?? 'No classes found'}
        </div>
      ) : activeTab === 'ALL' ? (
        /* ── ALL: table view (newest → oldest) ── */
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <Table
            keyField="publicId"
            data={classes}
            onRowClick={(c) => navigate(`/dashboard/tutor/classes/${c.publicId}`)}
            columns={[
              {
                key: 'subject',
                header: 'Class',
                render: (c) => <span className="font-medium text-gray-900 dark:text-white">{c.subject || 'Class'}</span>,
              },
              {
                key: 'classType',
                header: 'Type',
                render: (c) => <Badge variant="purple">{c.classType.replace(/_/g, ' ')}</Badge>,
              },
              {
                key: 'scheduledStartUTC',
                header: 'Date & Time',
                render: (c) => (
                  <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {new Date(c.scheduledStartUTC).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (c) => <Badge variant={STATUS_VARIANT[c.status] ?? 'default'}>{c.status}</Badge>,
              },
            ]}
            emptyMessage="No classes yet"
          />
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
                <div className="px-5 pb-5 -mt-2 bg-white dark:bg-gray-800 rounded-b-xl border border-t-0 border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => navigate(`/dashboard/tutor/classes/${cls.publicId}`)}
                    className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    View full details →
                  </button>
                  {/* Primary actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => openUpload(cls, 'WORKSHEET')}
                      className="flex items-center justify-center gap-1.5 text-xs font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/20 hover:bg-brand-100 dark:hover:bg-brand-900/40 rounded-lg py-2 transition-colors"
                    >
                      <BookOpen className="h-3.5 w-3.5" /> Worksheet
                    </button>
                    <button
                      onClick={() => openUpload(cls, 'ASSIGNMENT')}
                      className="flex items-center justify-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/40 rounded-lg py-2 transition-colors"
                    >
                      <ClipboardList className="h-3.5 w-3.5" /> Assignment
                    </button>
                  </div>

                  {/* Refund — only for paid classes (demo/free move no money) */}
                  {cls.classType !== 'DEMO' && cls.costCents > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                      {cls.isRefunded ? (
                        <span className="flex w-full items-center justify-center gap-1.5 text-xs font-medium text-gray-400 py-1">
                          <RotateCcw className="h-3.5 w-3.5" /> Refunded
                        </span>
                      ) : (
                        <button
                          onClick={() => { setRefundTarget(cls); setRefundReason(''); }}
                          className="flex w-full items-center justify-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg py-1.5 transition-colors"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Refund this class
                        </button>
                      )}
                    </div>
                  )}
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

      {/* Refund modal */}
      <Modal
        open={!!refundTarget}
        onClose={() => setRefundTarget(null)}
        title="Refund Class"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRefundTarget(null)}>Back</Button>
            <Button variant="danger" onClick={handleRefund} loading={refunding} disabled={!refundReason.trim()}>
              Confirm Refund
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            This reverses the charge for a completed class the student is refunded in full and your
            earning for it is clawed back. This cannot be undone.
          </p>
          <textarea
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            rows={3}
            placeholder="Reason for refund…"
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
