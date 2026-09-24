// frontend/src/pages/tutor/TutorCourseRequestsPage.tsx
import { useState } from 'react';
import { ClipboardList, Check, X, Inbox, CalendarPlus } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { Tabs } from '../../components/ui/Tabs';
import {
  useCourseRequestsAsTutor,
  useAcceptCourseRequest,
  useRejectCourseRequest,
  useScheduleCourseClass,
} from '../../hooks/use-course-requests';
import type { CourseRequest } from '../../services/course-requests.service';

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'REJECTED', label: 'Rejected' },
];

function AcceptForm({ requestPublicId }: { requestPublicId: string }) {
  const [classesRequired, setClassesRequired] = useState(4);
  const { mutate: accept, isPending } = useAcceptCourseRequest();
  return (
    <div className="mt-3 flex items-center gap-2">
      <input
        type="number"
        min={1}
        max={200}
        value={classesRequired}
        onChange={(e) => setClassesRequired(Number(e.target.value))}
        className="w-20 rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1.5 text-sm bg-white dark:bg-gray-900"
      />
      <span className="text-xs text-gray-500">classes needed to cover the selected topics</span>
      <Button
        size="sm"
        variant="gradient"
        loading={isPending}
        disabled={classesRequired < 1 || classesRequired > 200}
        onClick={() => accept({ requestPublicId, classesRequired })}
      >
        <Check className="h-3.5 w-3.5" /> Confirm accept
      </Button>
    </div>
  );
}

function ScheduleClassForm({
  requestPublicId,
  topicIds,
  topicTitles,
}: {
  requestPublicId: string;
  topicIds: string[];
  topicTitles?: string[];
}) {
  const [startUTC, setStartUTC] = useState('');
  const [endUTC, setEndUTC] = useState('');
  const [title, setTitle] = useState('');
  // No default: the tutor must consciously pick the topic this class covers.
  const [topicId, setTopicId] = useState('');
  const { mutate: schedule, isPending } = useScheduleCourseClass();

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-gray-100 dark:border-gray-800 p-3">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Class title" className="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1.5 text-sm bg-white dark:bg-gray-900" />
      <div className="flex gap-2">
        <input type="datetime-local" value={startUTC} onChange={(e) => setStartUTC(e.target.value)} className="rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1.5 text-sm bg-white dark:bg-gray-900" />
        <input type="datetime-local" value={endUTC} onChange={(e) => setEndUTC(e.target.value)} className="rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1.5 text-sm bg-white dark:bg-gray-900" />
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
        disabled={!title || !startUTC || !endUTC || !topicId}
        onClick={() =>
          schedule({
            requestPublicId,
            dto: {
              title,
              startUTC: new Date(startUTC).toISOString(),
              endUTC: new Date(endUTC).toISOString(),
              courseTopicPublicId: topicId,
            },
          })
        }
      >
        <CalendarPlus className="h-3.5 w-3.5" /> Schedule class
      </Button>
    </div>
  );
}

function RequestCard({ request }: { request: CourseRequest }) {
  const [showReject, setShowReject] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [reason, setReason] = useState('');
  const { mutate: reject, isPending: rejecting } = useRejectCourseRequest();

  return (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Badge variant={request.status === 'PENDING' ? 'warning' : request.status === 'ACCEPTED' ? 'success' : 'default'} tone="soft">
              {request.status}
            </Badge>
            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
              {request.studentName ?? 'Student'} · {request.courseTitle ?? 'Course'}
            </p>
            <p className="mt-1 text-xs text-gray-500">{request.selectedTopicPublicIds.length} topics selected</p>
            {request.status === 'ACCEPTED' && (
              <p className="mt-1 text-xs text-gray-500">
                {request.classesScheduledCount} of {request.classesRequired} scheduled ·{' '}
                {request.classesCompletedCount} completed
              </p>
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
        </div>

        {request.status === 'PENDING' && <AcceptForm requestPublicId={request.publicId} />}

        {showReject && (
          <div className="mt-3 space-y-2">
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Reason" className="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm bg-white dark:bg-gray-900" />
            <Button size="sm" variant="danger" loading={rejecting} disabled={!reason.trim()} onClick={() => reject({ requestPublicId: request.publicId, reason: reason.trim() })}>
              Confirm reject
            </Button>
          </div>
        )}

        {showSchedule && (
          <ScheduleClassForm
            requestPublicId={request.publicId}
            topicIds={request.selectedTopicPublicIds}
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
  const { data, isLoading } = useCourseRequestsAsTutor(statusParam ? { status: statusParam, limit: '50' } : { limit: '50' });
  const requests = data?.items ?? [];

  return (
    <div className="animate-fade-in">
      <PageHeader eyebrow="Tutor Studio" title="Course Requests" description="Review curriculum requests and schedule the classes." icon={<ClipboardList className="h-5 w-5" />} />
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
