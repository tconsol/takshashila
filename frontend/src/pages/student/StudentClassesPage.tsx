import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/shared/PageHeader';
import { ClassCard } from '../../components/shared/ClassCard';
import { BookClassModal } from '../../components/shared/BookClassModal';
import { Tabs } from '../../components/ui/Tabs';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useMyClassesAsStudent, useCancelClass, useRespondToClassRequest, useFundNextBlock, LIVE_STATUS_POLL } from '../../hooks/use-classes';
import { useConfirm } from '../../hooks/use-confirm';
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

  const poll = { refetchInterval: LIVE_STATUS_POLL };
  const { data: liveData } = useMyClassesAsStudent({ status: 'LIVE', limit: '1' }, poll);
  const hasLive = (liveData?.total ?? 0) > 0;

  // Lightweight counts per status (independent of the active tab) so a status
  // change — e.g. a class moving into Completed — lights up that tab even
  // while viewing a different one.
  const { data: scheduledCount } = useMyClassesAsStudent({ status: 'SCHEDULED', limit: '1' }, poll);
  const { data: completedCount } = useMyClassesAsStudent({ status: 'COMPLETED', limit: '1' }, poll);
  const { data: cancelledCount } = useMyClassesAsStudent({ status: 'CANCELLED', limit: '1' }, poll);
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
    { key: 'INCOMPLETE', label: 'Incomplete' },
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
  const { mutateAsync: respond } = useRespondToClassRequest();
  const { mutateAsync: fundNext, isPending: funding } = useFundNextBlock();
  const { confirm, confirmDialog } = useConfirm();
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
  // Accepted recurring requests whose next 30 days still need funding (one entry per series).
  const unfundedSeries = (() => {
    const bySeries = new Map<string, { cls: ClassRecord; sessions: ClassRecord[] }>();
    for (const c of classes) {
      if (c.requestStatus !== 'ACCEPTED' || c.status !== 'SCHEDULED' || !c.fundedThrough) continue;
      if (new Date(c.scheduledStartUTC).getTime() < new Date(c.fundedThrough).getTime()) continue;
      const key = c.seriesPublicId ?? c.publicId;
      const entry = bySeries.get(key) ?? { cls: c, sessions: [] };
      entry.sessions.push(c);
      bySeries.set(key, entry);
    }
    return [...bySeries.values()].map(({ cls, sessions }) => {
      const sorted = sessions.sort((a, b) => new Date(a.scheduledStartUTC).getTime() - new Date(b.scheduledStartUTC).getTime());
      const first = new Date(sorted[0].scheduledStartUTC).getTime();
      const block = sorted.filter((s) => new Date(s.scheduledStartUTC).getTime() < first + 30 * 86_400_000);
      const credits = block.reduce((sum, s) => sum + (s.costCents > 0 ? s.costCents + 100 : 0), 0) / 100;
      const opensAt = first - 15 * 86_400_000;
      return { cls: sorted[0], title: cls.subject, sessions: block.length, credits, first, opensAt, open: Date.now() >= opensAt };
    });
  })();
  // Tutor-created classes waiting for this student's accept or decline (one per series, not per session).
  const requestCount = new Set(
    classes.filter((c) => c.requestStatus === 'PENDING' && c.status === 'SCHEDULED').map((c) => c.seriesPublicId ?? c.publicId),
  ).size;

  /** Answering a tutor's class request covers the whole series; say what accepting commits the student to. */
  const answerRequest = async (answer: 'accept' | 'decline', cls: ClassRecord) => {
    const open = classes.filter((c) => c.requestStatus === 'PENDING' && c.status === 'SCHEDULED'
      && (cls.seriesPublicId ? c.seriesPublicId === cls.seriesPublicId : c.publicId === cls.publicId));
    const sessions = Math.max(1, open.length);
    if (answer === 'decline') {
      const { confirmed } = await confirm({
        title: 'Decline this class?',
        message: `You will not be charged. ${sessions > 1 ? `All ${sessions} sessions in this request are declined.` : 'The tutor is told you declined.'}`,
        confirmLabel: 'Decline',
        tone: 'danger',
      });
      if (confirmed) await respond({ classId: cls.publicId, answer }).catch(() => {});
      return;
    }
    const starts = open.map((c) => new Date(c.scheduledStartUTC).getTime()).sort((a, b) => a - b);
    const blockEnd = (starts[0] ?? Date.now()) + 30 * 86_400_000;
    const inBlock = open.filter((c) => new Date(c.scheduledStartUTC).getTime() < blockEnd);
    const holdCents = inBlock.reduce((sum, c) => sum + (c.costCents > 0 ? c.costCents + 100 : 0), 0);
    const { confirmed } = await confirm({
      title: 'Accept this class?',
      message: holdCents > 0
        ? `You need ${(holdCents / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })} credits available to cover ${inBlock.length > 1 ? `the ${inBlock.length} sessions in the next 30 days` : 'this session'} (price plus 1 credit platform fee each). Nothing is deducted now: each session is charged only after it is completed.${sessions > inBlock.length ? ' Later sessions are confirmed as the series goes on.' : ''}`
        : 'This session is free.',
      confirmLabel: 'Accept',
      tone: 'primary',
    });
    if (confirmed) await respond({ classId: cls.publicId, answer }).catch(() => {});
  };

  const handleAction = (action: 'start' | 'complete' | 'cancel' | 'join' | 'rate' | 'accept' | 'decline', cls: ClassRecord) => {
    if (action === 'accept' || action === 'decline') { void answerRequest(action, cls); }
    else if (action === 'cancel') { setCancelTarget(cls); setCancelReason(''); }
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

        {requestCount > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-900/20">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>{requestCount}</strong> class request{requestCount === 1 ? '' : 's'} from your tutors {requestCount === 1 ? 'is' : 'are'} waiting for your answer.
            </p>
            <Button size="sm" variant="outline" onClick={() => { setActiveTab('SCHEDULED'); markSeen('SCHEDULED'); }}>
              Review
            </Button>
          </div>
        )}

        {unfundedSeries.map((u) => (
          <div key={u.cls.seriesPublicId ?? u.cls.publicId} className="flex items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-800/40 dark:bg-sky-900/20">
            <p className="text-sm text-sky-800 dark:text-sky-200">
              <strong>{u.title || 'Recurring class'}</strong> continues on {new Date(u.first).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.
              {' '}Fund the next {u.sessions} session{u.sessions === 1 ? '' : 's'} ({u.credits.toLocaleString('en-US', { maximumFractionDigits: 2 })} credits) before then, or the remaining sessions are cancelled.
              {' '}Nothing is charged until each session is completed.
              {!u.open && <> You can fund from {new Date(u.opensAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.</>}
            </p>
            <Button size="sm" disabled={!u.open || funding} onClick={() => { void fundNext(u.cls.publicId).catch(() => {}); }}>
              Fund next 30 days
            </Button>
          </div>
        ))}

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
                  render: (c) => c.isRefunded
                    ? <Badge variant="default">REFUNDED</Badge>
                    : c.requestStatus === 'PENDING' && c.status === 'SCHEDULED'
                      ? <Badge variant="warning">AWAITING YOUR ANSWER</Badge>
                      : <Badge variant={STATUS_VARIANT[c.status] ?? 'default'}>{c.status}</Badge>,
                },
                {
                  key: 'actions',
                  header: '',
                  render: (c) => {
                    const live = c.status === 'LIVE' || c.status === 'IN_PROGRESS';
                    const startMs = new Date(c.scheduledStartUTC).getTime();
                    const joinable = live || (c.status === 'SCHEDULED' && Date.now() >= startMs - 15 * 60_000);
                    if (c.requestStatus === 'PENDING' && c.status === 'SCHEDULED') {
                      return (
                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" onClick={() => handleAction('accept', c)}>Accept</Button>
                          <Button size="sm" variant="outline" onClick={() => handleAction('decline', c)}>Decline</Button>
                        </div>
                      );
                    }
                    return (
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        {(live || c.status === 'SCHEDULED') && (
                          <Button
                            size="sm"
                            disabled={!joinable}
                            title={joinable ? undefined : 'Available 15 minutes before class starts'}
                            onClick={() => (c.meetingUrl && c.meetingProvider && c.meetingProvider !== 'native'
                              ? window.open(c.meetingUrl, '_blank', 'noopener,noreferrer')
                              : navigate(`/class/${c.publicId}`))}
                          >
                            Join
                          </Button>
                        )}
                        {c.status === 'SCHEDULED' && (
                          <Button size="sm" variant="outline" onClick={() => handleAction('cancel', c)}>Cancel</Button>
                        )}
                        {c.status === 'COMPLETED' && !c.isRefunded && !ratedIds?.has(c.publicId) && (
                          <Button size="sm" variant="outline" onClick={() => handleAction('rate', c)}>Rate</Button>
                        )}
                      </div>
                    );
                  },
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

      {confirmDialog}

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
            Please provide a reason. Nothing is charged for a booked class until it is completed, so there is nothing to
            refund; if this was a prepaid course class, its price returns to your wallet.
          </p>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            Cancelling a paid class less than 24 hours before it starts costs a 1 credit fee. Earlier cancellations and free demo classes are free.
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
