import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserCheck, Users } from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '../../components/shared/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/shared/EmptyState';
import { Spinner } from '../../components/ui/Loading';
import { useParentChildren, useChildAttendance } from '../../hooks/use-parent';
import { cn } from '../../lib/utils';

const statusBadge: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
  PRESENT: 'success', ABSENT: 'danger', PARTIAL: 'warning', EXCUSED: 'default',
};

export function ParentAttendancePage() {
  const { data: children = [], isLoading: childrenLoading } = useParentChildren();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId && children.length > 0) setSelectedId(children[0].publicId);
  }, [children, selectedId]);

  const { data, isLoading: attLoading } = useChildAttendance(selectedId ?? '', { limit: '100' });
  const selectedChild = children.find((c) => c.publicId === selectedId);
  const items = data?.items ?? [];

  const present = items.filter((a) => a.status === 'PRESENT' || a.status === 'PARTIAL').length;
  const absent = items.filter((a) => a.status === 'ABSENT').length;
  const rate = items.length > 0 ? Math.round((present / items.length) * 100) : (selectedChild?.attendanceRate ?? 0);

  if (childrenLoading) return <div className="flex justify-center py-20"><Spinner /></div>;

  if (children.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-8 w-8" />}
        title="No children linked"
        description="Add your child's Student ID to start monitoring their attendance."
        action={<Link to="/dashboard/parent/children"><Button variant="gradient"><Users className="h-4 w-4 mr-1.5" /> My Children</Button></Link>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        subtitle={selectedChild ? `${selectedChild.firstName} ${selectedChild.lastName}`.trim() : 'Loading…'}
        icon={<UserCheck className="h-5 w-5" />}
      />

      {/* Child selector */}
      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {children.map((child) => {
            const name = `${child.firstName} ${child.lastName}`.trim();
            return (
              <button
                key={child.publicId}
                onClick={() => setSelectedId(child.publicId)}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                  selectedId === child.publicId
                    ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-600 dark:bg-brand-900/20 dark:text-brand-300'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
                )}
              >
                <Avatar name={name} size="xs" />
                {name}
              </button>
            );
          })}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20 p-5 text-center">
          <p className="text-3xl font-bold text-green-700 dark:text-green-400">{present}</p>
          <p className="mt-1 text-sm text-green-600 dark:text-green-500">Present</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-5 text-center">
          <p className="text-3xl font-bold text-red-700 dark:text-red-400">{absent}</p>
          <p className="mt-1 text-sm text-red-600 dark:text-red-500">Absent</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 p-5 text-center">
          <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{rate}%</p>
          <p className="mt-1 text-sm text-blue-600 dark:text-blue-500">Attendance Rate</p>
        </div>
      </div>

      {/* Progress bar */}
      {!attLoading && items.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600 dark:text-gray-400 font-medium">Overall Attendance</span>
            <span className={`font-semibold ${rate >= 75 ? 'text-green-600' : rate >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
              {rate}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${rate >= 75 ? 'bg-green-500' : rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(rate, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">Minimum 75% required for good standing</p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Attendance History</h3>
        </div>
        <div className="p-4">
          <Table
            columns={[
              {
                key: 'createdAt',
                header: 'Date',
                render: (a) => <span className="text-sm">{format(new Date(a.createdAt), 'EEE, MMM d yyyy')}</span>,
              },
              {
                key: 'status',
                header: 'Status',
                render: (a) => <Badge variant={statusBadge[a.status] ?? 'default'}>{a.status}</Badge>,
              },
              {
                key: 'durationPresentMinutes',
                header: 'Duration',
                render: (a) => `${a.durationPresentMinutes} min`,
              },
              {
                key: 'remarks',
                header: 'Remarks',
                render: (a) => <span className="text-xs text-gray-500 dark:text-gray-400">{a.remarks ?? '—'}</span>,
              },
            ]}
            data={items}
            keyField="publicId"
            loading={attLoading}
            emptyMessage="No attendance records"
          />
        </div>
      </div>
    </div>
  );
}
