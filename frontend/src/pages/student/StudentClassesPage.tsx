import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/shared/PageHeader';
import { ClassCard } from '../../components/shared/ClassCard';
import { BookClassModal } from '../../components/shared/BookClassModal';
import { Tabs } from '../../components/ui/Tabs';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useMyClassesAsStudent, useCancelClass } from '../../hooks/use-classes';
import { useTutorSearch } from '../../hooks/use-tutors';
import { useTabActivity } from '../../hooks/use-tab-activity';
import type { ClassRecord } from '../../services/classes.service';
import type { TutorProfile } from '../../services/tutors.service';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import { RateClassModal } from '../../features/ratings/RateClassModal';
import { useMyRatedClassIds } from '../../features/ratings/use-ratings';
import { useStartConversation } from '../../features/chat/use-chat';

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

export function StudentClassesPage() {
  const [activeTab, setActiveTab] = useState('ALL');
  const [showFindTutor, setShowFindTutor] = useState(false);

  const { data: liveData } = useMyClassesAsStudent({ status: 'LIVE', limit: '1' });
  const hasLive = (liveData?.total ?? 0) > 0;

  // Lightweight counts per status (independent of the active tab) so a status
  // change — e.g. a class moving into Completed — lights up that tab even
  // while viewing a different one.
  const { data: scheduledCount } = useMyClassesAsStudent({ status: 'SCHEDULED', limit: '1' });
  const { data: completedCount } = useMyClassesAsStudent({ status: 'COMPLETED', limit: '1' });
  const { data: cancelledCount } = useMyClassesAsStudent({ status: 'CANCELLED', limit: '1' });
  const { dirty, markSeen } = useTabActivity(
    { SCHEDULED: scheduledCount?.total, COMPLETED: completedCount?.total, CANCELLED: cancelledCount?.total },
    activeTab,
  );

  const TABS = [
    { key: 'ALL', label: 'All' },
    { key: 'SCHEDULED', label: 'Upcoming', indicator: dirty.has('SCHEDULED') },
    { key: 'LIVE', label: 'In Progress', indicator: hasLive },
    { key: 'COMPLETED', label: 'Completed', indicator: dirty.has('COMPLETED') },
    { key: 'CANCELLED', label: 'Cancelled', indicator: dirty.has('CANCELLED') },
  ];
  const [bookingTutor, setBookingTutor] = useState<TutorProfile | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ClassRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [rateTarget, setRateTarget] = useState<ClassRecord | null>(null);
  const [sessionRatedIds, setSessionRatedIds] = useState<Set<string>>(new Set());
  const { data: serverRatedIds = [] } = useMyRatedClassIds();
  const ratedIds = new Set([...serverRatedIds, ...sessionRatedIds]);

  const { data, isLoading } = useMyClassesAsStudent(activeTab === 'ALL' ? { limit: '100' } : { status: activeTab });
  const { data: tutorResult } = useTutorSearch({ limit: 20 });
  const { mutateAsync: cancelClass, isPending: cancelling } = useCancelClass();
  const { mutateAsync: startConversation } = useStartConversation();
  const navigate = useNavigate();

  const handleMessageTutor = async (tutor: TutorProfile) => {
    const conv = await startConversation({ recipientPublicId: tutor.publicId, recipientRole: 'TUTOR' });
    navigate(`/chat/${conv.publicId}`);
  };

  const classes = (data?.items ?? []).slice().sort(
    (a, b) => new Date(b.scheduledStartUTC).getTime() - new Date(a.scheduledStartUTC).getTime(),
  ); // newest → oldest
  const tutors = tutorResult?.items ?? [];

  const handleAction = (action: 'start' | 'complete' | 'cancel' | 'join' | 'rate', cls: ClassRecord) => {
    if (action === 'cancel') { setCancelTarget(cls); setCancelReason(''); }
    else if (action === 'rate') { setRateTarget(cls); }
    else if (action === 'join' && cls.meetingUrl) window.open(cls.meetingUrl, '_blank');
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    await cancelClass({ classId: cancelTarget.publicId, dto: { reason: cancelReason } });
    setCancelTarget(null);
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader title="My Classes" subtitle="View and manage your booked sessions" />
          <Button onClick={() => setShowFindTutor(true)}>+ Book a Class</Button>
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
              <ClassCard key={cls.publicId} cls={cls} perspective="student" onAction={handleAction} ratedClassIds={ratedIds} />
            ))}
          </div>
        )}
      </div>

      {/* Find tutor modal */}
      <Modal
        open={showFindTutor && !bookingTutor}
        onClose={() => setShowFindTutor(false)}
        title="Find a Tutor"
        size="lg"
      >
        <div className="space-y-2">
          {tutors.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No tutors available</p>
          ) : (
            tutors.map((tutor) => (
              <div
                key={tutor.publicId}
                className="flex items-center gap-4 p-3 rounded-xl border border-gray-200 dark:border-gray-700"
              >
                <Avatar name={tutor.displayName} size="md" />
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => { setBookingTutor(tutor); setShowFindTutor(false); }}
                >
                  <p className="font-medium text-gray-900 dark:text-white">{tutor.displayName}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tutor.subjects.slice(0, 3).map((s) => (
                      <span key={s} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded px-1.5 py-0.5">{s}</span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-1">
                    {tutor.isVerified && <Badge variant="success">Verified</Badge>}
                    <span className="text-xs text-yellow-500">★ {tutor.rating.toFixed(1)}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => handleMessageTutor(tutor)}>Message</Button>
                    <Button size="sm" onClick={() => { setBookingTutor(tutor); setShowFindTutor(false); }}>Book</Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      {bookingTutor && (
        <BookClassModal
          open
          onClose={() => setBookingTutor(null)}
          tutor={bookingTutor}
          onSuccess={() => setBookingTutor(null)}
        />
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
            You will be refunded to your wallet. Please provide a reason.
          </p>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={3}
            placeholder="Reason for cancellation…"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      </Modal>

      {rateTarget && (
        <RateClassModal
          classPublicId={rateTarget.publicId}
          onClose={() => setRateTarget(null)}
          onDone={() => {
            setSessionRatedIds((prev) => new Set([...prev, rateTarget.publicId]));
            setRateTarget(null);
          }}
        />
      )}
    </>
  );
}
