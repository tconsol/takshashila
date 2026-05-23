import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, Clock, Users } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatsCard } from '../../components/shared/StatsCard';
import { Badge } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import { attendanceService } from '../../services/attendance.service';
import { studentsService } from '../../services/students.service';

type AttVariant = 'success' | 'danger' | 'warning' | 'default';

const statusVariant: Record<string, AttVariant> = {
  PRESENT: 'success',
  ABSENT: 'danger',
  PARTIAL: 'warning',
  EXCUSED: 'default',
};

export function TutorAttendancePage() {
  const { data: attendanceData, isLoading } = useQuery({
    queryKey: ['attendance', 'tutor', 'my'],
    queryFn: () => attendanceService.getMyHistoryAsTutor({ limit: 100 }),
  });

  const { data: myStudents } = useQuery({
    queryKey: ['students', 'my-tutor'],
    queryFn: () => studentsService.getMyStudentsAsTutor({ limit: '200' }),
  });

  const records = attendanceData?.items ?? [];

  const studentNameMap = new Map(
    (myStudents?.items ?? []).map((s) => [
      s.publicId,
      s.displayName || `${s.firstName} ${s.lastName}`.trim(),
    ]),
  );

  const present = records.filter((r) => r.status === 'PRESENT' || r.status === 'PARTIAL').length;
  const absent = records.filter((r) => r.status === 'ABSENT').length;
  const excused = records.filter((r) => r.status === 'EXCUSED').length;
  const avgDuration =
    present > 0
      ? Math.round(
          records
            .filter((r) => r.status === 'PRESENT' || r.status === 'PARTIAL')
            .reduce((s, r) => s + r.durationPresentMinutes, 0) / present,
        )
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Records"
        subtitle="Attendance history across all your classes"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Records"
          value={isLoading ? '—' : records.length}
          icon={<Users className="h-5 w-5 text-brand-600" />}
        />
        <StatsCard
          title="Present"
          value={isLoading ? '—' : present}
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
          iconBg="bg-green-50 dark:bg-green-900/20"
          change={records.length > 0 ? { value: `${Math.round((present / records.length) * 100)}%`, positive: true } : undefined}
        />
        <StatsCard
          title="Absent"
          value={isLoading ? '—' : absent}
          icon={<XCircle className="h-5 w-5 text-red-500" />}
          iconBg="bg-red-50 dark:bg-red-900/20"
          change={records.length > 0 ? { value: `${Math.round((absent / records.length) * 100)}%`, positive: false } : undefined}
        />
        <StatsCard
          title="Avg Duration"
          value={isLoading ? '—' : `${avgDuration} min`}
          icon={<Clock className="h-5 w-5 text-violet-600" />}
          iconBg="bg-violet-50 dark:bg-violet-900/20"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">All Attendance Records</h3>
          {excused > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">{excused} excused</span>
          )}
        </div>
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
                key: 'studentPublicId',
                header: 'Student',
                render: (r) => (
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {studentNameMap.get(r.studentPublicId) ?? `Student ${r.studentPublicId.slice(0, 6)}`}
                  </span>
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
                render: (r) => (
                  <span className="text-xs text-gray-500 dark:text-gray-400">{r.remarks ?? '—'}</span>
                ),
              },
            ]}
            data={records}
            keyField="publicId"
            loading={isLoading}
            emptyMessage="No attendance records yet"
          />
        </div>
      </div>
    </div>
  );
}
