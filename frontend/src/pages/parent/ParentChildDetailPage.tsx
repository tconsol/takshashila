import { useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, ClipboardList, BookOpen, FileText, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '../../components/shared/PageHeader';
import { Tabs } from '../../components/ui/Tabs';
import { Badge } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import { Spinner } from '../../components/ui/Loading';
import {
  useParentChildren,
  useChildClasses,
  useChildAttendance,
  useChildAssignments,
  useChildWorksheets,
} from '../../hooks/use-parent';

const classTabs = [
  { key: 'classes', label: 'Classes' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'assignments', label: 'Assignments' },
  { key: 'worksheets', label: 'Worksheets' },
];

const classStatusBadge: Record<string, 'info' | 'warning' | 'success' | 'danger' | 'default'> = {
  SCHEDULED: 'info', IN_PROGRESS: 'warning', COMPLETED: 'success', CANCELLED: 'danger',
};
const attendanceBadge: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
  PRESENT: 'success', ABSENT: 'danger', PARTIAL: 'warning', EXCUSED: 'default',
};
const submissionBadge: Record<string, 'default' | 'warning' | 'success' | 'danger'> = {
  NOT_SUBMITTED: 'default', SUBMITTED: 'warning', GRADED: 'success', LATE: 'danger',
};

function ClassesTab({ studentPublicId }: { studentPublicId: string }) {
  const { data, isLoading } = useChildClasses(studentPublicId, { limit: '20' });
  return (
    <Table
      columns={[
        { key: 'title', header: 'Class', render: (c) => <span className="font-medium text-gray-800 dark:text-gray-200">{c.title}</span> },
        { key: 'classType', header: 'Type', render: (c) => <Badge variant="info">{c.classType}</Badge> },
        { key: 'status', header: 'Status', render: (c) => <Badge variant={classStatusBadge[c.status] ?? 'default'}>{c.status}</Badge> },
        { key: 'startUTC', header: 'Date', render: (c) => c.startUTC ? format(new Date(c.startUTC), 'MMM d, yyyy h:mm a') : '—' },
      ]}
      data={data?.items ?? []}
      keyField="publicId"
      loading={isLoading}
      emptyMessage="No classes found"
    />
  );
}

function AttendanceTab({ studentPublicId }: { studentPublicId: string }) {
  const { data, isLoading } = useChildAttendance(studentPublicId, { limit: '30' });
  const items = data?.items ?? [];
  const present = items.filter((a) => a.status === 'PRESENT').length;
  const absent = items.filter((a) => a.status === 'ABSENT').length;
  const rate = items.length > 0 ? Math.round((present / items.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 text-center">
          <p className="text-2xl font-bold text-green-700 dark:text-green-400">{present}</p>
          <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">Present</p>
        </div>
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-center">
          <p className="text-2xl font-bold text-red-700 dark:text-red-400">{absent}</p>
          <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">Absent</p>
        </div>
        <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 text-center">
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{rate}%</p>
          <p className="text-xs text-blue-600 dark:text-blue-500 mt-0.5">Rate</p>
        </div>
      </div>
      <Table
        columns={[
          { key: 'status', header: 'Status', render: (a) => <Badge variant={attendanceBadge[a.status] ?? 'default'}>{a.status}</Badge> },
          { key: 'durationPresentMinutes', header: 'Duration', render: (a) => `${a.durationPresentMinutes} min` },
          { key: 'remarks', header: 'Remarks', render: (a) => a.remarks ?? '—' },
          { key: 'createdAt', header: 'Date', render: (a) => format(new Date(a.createdAt), 'MMM d, yyyy') },
        ]}
        data={items}
        keyField="publicId"
        loading={isLoading}
        emptyMessage="No attendance records"
      />
    </div>
  );
}

function AssignmentsTab({ studentPublicId }: { studentPublicId: string }) {
  const { data: assignments = [], isLoading } = useChildAssignments(studentPublicId);

  if (isLoading) return <div className="flex justify-center py-10"><Spinner /></div>;
  if (assignments.length === 0) return <p className="text-center py-10 text-gray-400">No assignments</p>;

  return (
    <div className="space-y-3">
      {assignments.map((a) => (
        <div key={a.publicId} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white">{a.title}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{a.description}</p>
              <p className="text-xs text-gray-400 mt-1">Due: {format(new Date(a.dueDate), 'MMM d, yyyy h:mm a')}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <Badge variant={submissionBadge[a.submission?.status ?? 'NOT_SUBMITTED'] ?? 'default'}>
                {a.submission?.status ?? 'NOT_SUBMITTED'}
              </Badge>
              {a.submission?.score !== undefined && (
                <span className="text-xs font-medium text-green-600 dark:text-green-400">
                  {a.submission.score}/{a.maxScore}
                </span>
              )}
            </div>
          </div>
          {a.submission?.feedback && (
            <div className="mt-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">Feedback: </span>{a.submission.feedback}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function WorksheetsTab({ studentPublicId }: { studentPublicId: string }) {
  const { data, isLoading } = useChildWorksheets(studentPublicId, { limit: '20' });
  const items = data?.items ?? [];

  if (isLoading) return <div className="flex justify-center py-10"><Spinner /></div>;
  if (items.length === 0) return <p className="text-center py-10 text-gray-400">No worksheets available</p>;

  return (
    <div className="space-y-3">
      {items.map((w) => (
        <div key={w.publicId} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-gray-900 dark:text-white">{w.title}</p>
                {w.subject && <Badge variant="info">{w.subject}</Badge>}
              </div>
              <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
                <span>{w.questions?.length ?? 0} questions</span>
                {w.dueDate && <span>Due {format(new Date(w.dueDate), 'MMM d')}</span>}
              </div>
              <p className="text-xs text-gray-400 mt-1">Added {format(new Date(w.createdAt), 'MMM d, yyyy')}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ParentChildDetailPage() {
  const { studentPublicId } = useParams<{ studentPublicId: string }>();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') ?? 'classes';
  const [activeTab, setActiveTab] = useState(initialTab);
  const { data: children = [] } = useParentChildren();

  if (!studentPublicId) return null;

  const child = children.find((c) => c.publicId === studentPublicId);
  const childName = child ? `${child.firstName} ${child.lastName}`.trim() : 'Child';

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/dashboard/parent/children"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 mb-3 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Children
        </Link>
        <PageHeader
          title={childName || 'Child\'s Progress'}
          subtitle={child?.grade ? `${child.grade} · Student` : 'Student'}
        />
      </div>

      <Tabs tabs={classTabs} activeTab={activeTab} onChange={setActiveTab} />

      <div>
        {activeTab === 'classes' && <ClassesTab studentPublicId={studentPublicId} />}
        {activeTab === 'attendance' && <AttendanceTab studentPublicId={studentPublicId} />}
        {activeTab === 'assignments' && <AssignmentsTab studentPublicId={studentPublicId} />}
        {activeTab === 'worksheets' && <WorksheetsTab studentPublicId={studentPublicId} />}
      </div>
    </div>
  );
}
