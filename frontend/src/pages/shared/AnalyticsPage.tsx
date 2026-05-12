import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, GraduationCap, Users } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatsCard } from '../../components/shared/StatsCard';
import { Table } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { api } from '../../lib/axios';
import { format } from 'date-fns';

interface PlatformStats {
  totalUsers: number;
  totalTutors: number;
  totalStudents: number;
  totalPrincipals: number;
  totalClasses: number;
  completedClasses: number;
  totalRevenueCents: number;
  activeUsers: number;
}

interface RecentClass {
  publicId: string;
  subject: string;
  status: string;
  scheduledStartUTC: string;
  costCents: number;
}

type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'default';

const classStatusVariant: Record<string, StatusVariant> = {
  COMPLETED: 'success',
  IN_PROGRESS: 'warning',
  CANCELLED: 'danger',
  SCHEDULED: 'info',
};

interface AnalyticsPageProps {
  role: 'admin' | 'principal' | 'super_admin';
  title?: string;
}

export function AnalyticsPage({ role, title = 'Analytics' }: AnalyticsPageProps) {
  const { data: stats, isLoading: statsLoading } = useQuery<PlatformStats>({
    queryKey: ['analytics', 'stats', role],
    queryFn: () => api.get('/classes/my/tutor?limit=1').then(() => ({
      totalUsers: 0, totalTutors: 0, totalStudents: 0, totalPrincipals: 0,
      totalClasses: 0, completedClasses: 0, totalRevenueCents: 0, activeUsers: 0,
    })),
    retry: false,
  });

  const { data: recentClasses = [], isLoading: classesLoading } = useQuery<RecentClass[]>({
    queryKey: ['analytics', 'recent-classes', role],
    queryFn: () => {
      const endpoint = role === 'super_admin' || role === 'admin'
        ? '/classes/my/tutor?limit=10'
        : '/classes/my/tutor?limit=10';
      return api.get(endpoint).then((r) => r.data.data?.items ?? []);
    },
    retry: false,
  });

  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle="Performance metrics and insights" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Classes"
          value={statsLoading ? '—' : (stats?.totalClasses ?? recentClasses.length)}
          icon={<CalendarDays className="h-5 w-5 text-brand-600" />}
        />
        <StatsCard
          title="Completed"
          value={statsLoading ? '—' : (stats?.completedClasses ?? recentClasses.filter((c) => c.status === 'COMPLETED').length)}
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
          iconBg="bg-green-50 dark:bg-green-900/20"
        />
        <StatsCard
          title="Total Tutors"
          value={statsLoading ? '—' : (stats?.totalTutors ?? '—')}
          icon={<GraduationCap className="h-5 w-5 text-violet-600" />}
          iconBg="bg-violet-50 dark:bg-violet-900/20"
        />
        <StatsCard
          title="Total Students"
          value={statsLoading ? '—' : (stats?.totalStudents ?? '—')}
          icon={<Users className="h-5 w-5 text-sky-600" />}
          iconBg="bg-sky-50 dark:bg-sky-900/20"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Recent Classes</h3>
        </div>
        <div className="p-4">
          <Table
            columns={[
              {
                key: 'subject',
                header: 'Subject',
                render: (c) => <span className="font-medium text-gray-800 dark:text-gray-200">{c.subject}</span>,
              },
              {
                key: 'status',
                header: 'Status',
                render: (c) => <Badge variant={classStatusVariant[c.status] ?? 'default'}>{c.status}</Badge>,
              },
              {
                key: 'scheduledStartUTC',
                header: 'Date',
                render: (c) => format(new Date(c.scheduledStartUTC), 'MMM d, yyyy h:mm a'),
              },
              {
                key: 'costCents',
                header: 'Value',
                render: (c) => (c.costCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
              },
            ]}
            data={recentClasses}
            keyField="publicId"
            loading={classesLoading}
            emptyMessage="No class data available"
          />
        </div>
      </div>
    </div>
  );
}
