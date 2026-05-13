import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { BarChart2, CheckCircle2, XCircle, Target } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatsCard } from '../../components/shared/StatsCard';
import { Badge } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import { useMyStudentProfile } from '../../hooks/use-students';
import { attendanceService } from '../../services/attendance.service';

type AttVariant = 'success' | 'danger' | 'warning' | 'default';

const statusVariant: Record<string, AttVariant> = {
  PRESENT: 'success',
  ABSENT: 'danger',
  PARTIAL: 'warning',
  EXCUSED: 'default',
};

export function StudentProgressPage() {
  const { data: profile, isLoading: profileLoading } = useMyStudentProfile();
  const { data: attendanceData, isLoading: attLoading } = useQuery({
    queryKey: ['attendance', 'my'],
    queryFn: () => attendanceService.getMyHistory({ limit: 50 }),
  });

  const records = attendanceData?.items ?? [];
  const attendancePct = profile?.attendanceRate ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="My Progress" subtitle="Attendance history and performance overview" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Attendance Rate"
          value={profileLoading ? '—' : `${attendancePct}%`}
          icon={<BarChart2 className="h-5 w-5 text-brand-600" />}
          change={attendancePct >= 75
            ? { value: 'Good standing', positive: true }
            : { value: 'Needs improvement', positive: false }
          }
        />
        <StatsCard
          title="Classes Attended"
          value={profileLoading ? '—' : profile?.totalClassesAttended ?? 0}
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
          iconBg="bg-green-50 dark:bg-green-900/20"
        />
        <StatsCard
          title="Classes Missed"
          value={profileLoading ? '—' : profile?.totalClassesMissed ?? 0}
          icon={<XCircle className="h-5 w-5 text-red-500" />}
          iconBg="bg-red-50 dark:bg-red-900/20"
        />
        <StatsCard
          title="Demo Classes Used"
          value={profileLoading ? '—' : `${profile?.demoClassesUsed ?? 0}/3`}
          icon={<Target className="h-5 w-5 text-violet-600" />}
          iconBg="bg-violet-50 dark:bg-violet-900/20"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Attendance History</h3>
        </div>

        {!profileLoading && profile && (
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-gray-600 dark:text-gray-400">Overall Attendance</span>
              <span className={`font-semibold ${attendancePct >= 75 ? 'text-green-600 dark:text-green-400' : attendancePct >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500'}`}>
                {attendancePct}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${attendancePct >= 75 ? 'bg-green-500' : attendancePct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(attendancePct, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Minimum 75% required to maintain good standing
            </p>
          </div>
        )}

        <div className="p-4">
          <Table
            columns={[
              {
                key: 'createdAt',
                header: 'Date',
                render: (r) => (
                  <span className="text-sm">{format(new Date(r.createdAt), 'EEE, MMM d yyyy')}</span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (r) => (
                  <Badge variant={statusVariant[r.status] ?? 'default'}>{r.status}</Badge>
                ),
              },
              {
                key: 'durationPresentMinutes',
                header: 'Duration',
                render: (r) => `${r.durationPresentMinutes} min`,
              },
              {
                key: 'source',
                header: 'Source',
                render: (r) => (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {r.source === 'MANUAL_OVERRIDE' ? 'Manual' : 'Auto'}
                  </span>
                ),
              },
              {
                key: 'remarks',
                header: 'Remarks',
                render: (r) => r.remarks ?? '—',
              },
            ]}
            data={records}
            keyField="publicId"
            loading={attLoading}
            emptyMessage="No attendance records yet"
          />
        </div>
      </div>
    </div>
  );
}
