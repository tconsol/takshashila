// frontend/src/pages/tutor/TutorCourseRequestsPage.tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardList, Check, X, Inbox, CalendarPlus, BookOpen } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { Tabs } from '../../components/ui/Tabs';
import {
  useIncomingCourses,
  useAcceptCourse,
  useRejectCourse,
  useScheduleCourseClass,
} from '../../hooks/use-courses';
import type { Course } from '../../services/courses.service';
import { useConfirm } from '../../hooks/use-confirm';
import { useMyTutorProfile } from '../../hooks/use-tutors';
import { formatCurrency } from '../../utils/currency';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Mirrors COURSE_CLASS_MINUTES in server/src/modules/courses/course.constants.ts.
const COURSE_CLASS_MINUTES = 60;

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'REJECTED', label: 'Rejected' },
];

function AcceptForm({ coursePublicId }: { coursePublicId: string }) {
  const [classesRequired, setClassesRequired] = useState(4);
  const { mutate: accept, isPending } = useAcceptCourse();
  const { confirm, confirmDialog } = useConfirm();
  const { data: myProfile } = useMyTutorProfile();
  const rateCents = (myProfile as { hourlyRateCents?: number } | undefined)?.hourlyRateCents ?? 0;
  const totalCredits = (rateCents * classesRequired) / 100;
  return (
    <div className="mt-3 flex items-center gap-2 flex-wrap">
      {confirmDialog}
      <input
        type="number"
        min={1}
        max={200}
        value={classesRequired}
        onChange={(e) => setClassesRequired(Number(e.target.value))}
        className="w-20 rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1.5 text-sm bg-white dark:bg-gray-900"
      />
      <span className="text-xs text-gray-500">
        classes of {COURSE_CLASS_MINUTES} min each = {totalCredits} credits ({classesRequired} × {rateCents / 100}/hr)
      </span>
      <Button
        size="sm"
        variant="gradient"
        loading={isPending}
        disabled={classesRequired < 1 || classesRequired > 200}
        onClick={async () => {
          const { confirmed } = await confirm({
            title: 'Accept this course request?',
            message: `The student will be charged ${totalCredits} credits up front (${classesRequired} classes of ${COURSE_CLASS_MINUTES} minutes at your ${rateCents / 100}/hour rate) and you will schedule those classes. If they cannot afford it, the request stays pending.`,
            confirmLabel: 'Accept and charge student',
            tone: 'primary',
          });
          if (confirmed) accept({ coursePublicId, classesRequired });
        }}
      >
        <Check className="h-3.5 w-3.5" /> Confirm accept
      </Button>
    </div>
  );
}

function ScheduleClassForm({
  coursePublicId,
  topicIds,
  topicTitles,
}: {
  coursePublicId: string;
  topicIds: string[];
  topicTitles?: string[];
}) {
  const [startUTC, setStartUTC] = useState('');
  const [title, setTitle] = useState('');
  // No default: the tutor must consciously pick the topic this class covers.
  const [topicId, setTopicId] = useState('');
  const { mutate: schedule, isPending } = useScheduleCourseClass();

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-gray-100 dark:border-gray-800 p-3">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Class title" className="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1.5 text-sm bg-white dark:bg-gray-900" />
      <div className="flex items-center gap-2">
        <input type="datetime-local" value={startUTC} onChange={(e) => setStartUTC(e.target.value)} className="rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1.5 text-sm bg-white dark:bg-gray-900" />
        <span className="text-xs text-gray-500">Every class is {COURSE_CLASS_MINUTES} minutes</span>
      </div>
      <label className="block text-xs font-medium text-gray-500">
        Topic this class covers <span className="text-red-500">*</span>
        <select
          required
          value={topicId}
          onChange={(e) => setTopicId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900"
        >
          <option value="" disabled>Select a topic</option>
          {topicIds.map((id, i) => <option key={id} value={id}>{topicTitles?.[i] ?? id}</option>)}
        </select>
      </label>
      <Button
        size="sm"
        variant="gradient"
        loading={isPending}
        disabled={!title || !startUTC || !topicId}
        onClick={() =>
          schedule(
            {
              coursePublicId,
              dto: {
                title,
                startUTC: new Date(startUTC).toISOString(),
                endUTC: new Date(new Date(startUTC).getTime() + COURSE_CLASS_MINUTES * 60_000).toISOString(),
                topicPublicId: topicId,
              },
            },
            {
              // Clear the form so the next class starts blank and a repeat click cannot double-book by accident.
              onSuccess: () => { setTitle(''); setStartUTC(''); setTopicId(''); },
            },
          )
        }
      >
        <CalendarPlus className="h-3.5 w-3.5" /> Schedule class
      </Button>
      {(!title || !startUTC || !topicId) && (
        <p className="text-xs text-gray-500">
          Add a {[!title && 'title', !startUTC && 'start time', !topicId && 'topic'].filter(Boolean).join(', ')} to schedule this class.
        </p>
      )}
    </div>
  );
}

function RequestCard({ request }: { request: Course }) {
  const [showReject, setShowReject] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [reason, setReason] = useState('');
  const { mutate: reject, isPending: rejecting } = useRejectCourse();
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);
  const opensCourse = request.status === 'ACCEPTED' || request.status === 'COMPLETED';

  return (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div
            className="cursor-pointer flex-1 min-w-[16rem]"
            role="button"
            tabIndex={0}
            aria-expanded={showDetails}
            onClick={() => (opensCourse ? navigate(`/dashboard/tutor/course-requests/${request.publicId}`) : setShowDetails((v) => !v))}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (opensCourse ? navigate(`/dashboard/tutor/course-requests/${request.publicId}`) : setShowDetails((v) => !v)); } }}
          >
            <Badge variant={request.status === 'PENDING' ? 'warning' : request.status === 'ACCEPTED' ? 'success' : 'default'} tone="soft">
              {request.status}
            </Badge>
            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
              {request.studentName ?? 'Student'} · {request.curriculumTitle ?? 'Curriculum'}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {request.topicPublicIds.length} topics selected · requested {new Date(request.createdAt).toLocaleDateString()}
              {request.costCentsPerClass ? ` · ${formatCurrency(request.costCentsPerClass)}/class` : ''}
            </p>
            {request.status === 'ACCEPTED' && (
              <p className="mt-1 text-xs text-gray-500">
                {request.classesScheduledCount} of {request.classesRequired} scheduled ·{' '}
                {request.classesCompletedCount} completed
              </p>
            )}
            {request.availabilityWindow && (
              <p className="mt-1 text-xs text-gray-500">
                Free {request.availabilityWindow.daysOfWeek.map((d) => DAY_NAMES[d]).join(', ')} {request.availabilityWindow.startLocalTime}–{request.availabilityWindow.endLocalTime}
              </p>
            )}
            {showDetails && !opensCourse && (
              <ul className="mt-2 list-disc pl-5 text-xs text-gray-600 dark:text-gray-400">
                {(request.topicTitles ?? []).map((t) => <li key={t}>{t}</li>)}
              </ul>
            )}
            {request.status === 'REJECTED' && request.rejectionReason && (
              <p className="mt-1 text-xs text-gray-500">Reason: {request.rejectionReason}</p>
            )}
          </div>
          {request.status === 'PENDING' && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowReject((v) => !v)}>
                <X className="h-3.5 w-3.5" /> Reject
              </Button>
            </div>
          )}
          {request.status === 'ACCEPTED' && (request.classesScheduledCount < (request.classesRequired ?? 0)) && (
            <Button size="sm" variant="outline" onClick={() => setShowSchedule((v) => !v)}>
              <CalendarPlus className="h-3.5 w-3.5" /> Schedule next class
            </Button>
          )}
          {(request.status === 'ACCEPTED' || request.status === 'COMPLETED') && (
            <Link to={`/dashboard/tutor/course-requests/${request.publicId}`}>
              <Button size="sm" variant="outline"><BookOpen className="h-3.5 w-3.5" /> View course</Button>
            </Link>
          )}
        </div>

        {request.status === 'PENDING' && <AcceptForm coursePublicId={request.publicId} />}

        {showReject && (
          <div className="mt-3 space-y-2">
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Reason" className="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm bg-white dark:bg-gray-900" />
            <Button size="sm" variant="danger" loading={rejecting} disabled={!reason.trim()} onClick={() => reject({ coursePublicId: request.publicId, reason: reason.trim() })}>
              Confirm reject
            </Button>
          </div>
        )}

        {showSchedule && (
          <ScheduleClassForm
            coursePublicId={request.publicId}
            topicIds={request.topicPublicIds}
            topicTitles={request.topicTitles}
          />
        )}
      </CardContent>
    </Card>
  );
}

export function TutorCourseRequestsPage() {
  const [activeTab, setActiveTab] = useState('');
  const statusParam = activeTab === '' ? undefined : activeTab;
  const { data, isLoading } = useIncomingCourses(statusParam ? { status: statusParam, limit: '50' } : { limit: '50' });
  const requests = data?.items ?? [];

  return (
    <div className="animate-fade-in">
      <PageHeader eyebrow="Tutor Studio" title="Course requests" description="Review course requests and schedule the classes." icon={<ClipboardList className="h-5 w-5" />} />
      <Tabs tabs={STATUS_TABS} activeTab={activeTab} onChange={setActiveTab} className="mb-5" />
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : requests.length === 0 ? (
        <Card><CardContent><div className="flex flex-col items-center py-14 text-center gap-3"><Inbox className="h-6 w-6 text-gray-400" /><p className="text-sm text-gray-500">No course requests yet.</p></div></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => <RequestCard key={req.publicId} request={req} />)}
        </div>
      )}
    </div>
  );
}
