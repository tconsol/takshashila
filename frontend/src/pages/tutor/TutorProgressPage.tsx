import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Users, Video, CheckCircle2, CalendarDays } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatsCard } from '../../components/shared/StatsCard';
import { Badge } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import { api } from '../../lib/axios';
import { studentsService } from '../../services/students.service';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default';

const statusVariant: Record<string, BadgeVariant> = {
  COMPLETED: 'success',
  IN_PROGRESS: 'warning',
  CANCELLED: 'danger',
  SCHEDULED: 'info',
};

interface TutorStats {
  upcoming: number;
  completed: number;
  totalStudents: number;
}

interface RecentClass {
  publicId: string;
  subject: string;
  status: string;
  scheduledStartUTC?: string;
  startUTC?: string;
  studentPublicId: string;
}

export function TutorProgressPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<TutorStats>({
    queryKey: ['analytics', 'tutor', 'me'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/tutor/me');
      return (data?.data ?? data ?? {}) as TutorStats;
    },
  });

  const { data: classData, isLoading: classesLoading } = useQuery({
    queryKey: ['classes', 'tutor', 'completed', 'progress'],
    queryFn: async () => {
      const { data } = await api.get('/classes/my/tutor', {
        params: { status: 'COMPLETED', limit: 15 },
      });
      return (data?.data?.items ?? []) as RecentClass[];
    },
  });

  const { data: myStudents } = useQuery({
    queryKey: ['students', 'my-tutor'],
    queryFn: () => studentsService.getMyStudentsAsTutor({ limit: '200' }),
  });

  const studentNameMap = new Map(
    (myStudents?.items ?? []).map((s) => [
      s.publicId,
      s.displayName || `${s.firstName} ${s.lastName}`.trim(),
    ]),
  );

  const recentClasses = classData ?? [];

  const completionRate =
    stats && (stats.upcoming + stats.completed) > 0
      ? Math.round((stats.completed / (stats.upcoming + stats.completed)) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Progress"
        subtitle="Teaching performance and class history"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Completed Classes"
          value={statsLoading ? '—' : stats?.completed ?? 0}
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
          iconBg="bg-green-50 dark:bg-green-900/20"
        />
        <StatsCard
          title="Upcoming Classes"
          value={statsLoading ? '—' : stats?.upcoming ?? 0}
          icon={<CalendarDays className="h-5 w-5 text-brand-600" />}
        />
        <StatsCard
          title="Total Students"
          value={statsLoading ? '—' : stats?.totalStudents ?? 0}
          icon={<Users className="h-5 w-5 text-violet-600" />}
          iconBg="bg-violet-50 dark:bg-violet-900/20"
        />
        <StatsCard
          title="Completion Rate"
          value={statsLoading ? '—' : `${completionRate}%`}
          icon={<Video className="h-5 w-5 text-sky-600" />}
          iconBg="bg-sky-50 dark:bg-sky-900/20"
          change={completionRate >= 80 ? { value: 'Great pace', positive: true } : undefined}
        />
      </div>

      {/* Completion bar */}
      {!statsLoading && stats && (stats.completed + stats.upcoming) > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600 dark:text-gray-400 font-medium">Overall Completion</span>
            <span className="font-semibold text-green-600 dark:text-green-400">{completionRate}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div
              className="h-3 rounded-full bg-green-500 transition-all"
              style={{ width: `${Math.min(completionRate, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {stats.completed} completed · {stats.upcoming} upcoming
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Recent Completed Classes</h3>
        </div>
        <div className="p-4">
          <Table
            columns={[
              {
                key: 'subject',
                header: 'Subject',
                render: (c) => (
                  <span className="font-medium text-gray-800 dark:text-gray-200">{c.subject}</span>
                ),
              },
              {
                key: 'studentPublicId',
                header: 'Student',
                render: (c) => (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {studentNameMap.get(c.studentPublicId) ?? `Student ${c.studentPublicId.slice(0, 6)}`}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (c) => (
                  <Badge variant={statusVariant[c.status] ?? 'default'}>{c.status}</Badge>
                ),
              },
              {
                key: 'scheduledStartUTC',
                header: 'Date',
                render: (c) => {
                  const d = c.scheduledStartUTC ?? c.startUTC;
                  return d ? format(new Date(d), 'MMM d, yyyy') : '—';
                },
              },
            ]}
            data={recentClasses}
            keyField="publicId"
            loading={classesLoading}
            emptyMessage="No completed classes yet"
          />
        </div>
      </div>
    </div>
  );
}
