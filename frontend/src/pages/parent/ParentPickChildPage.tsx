import { useLocation, Link } from 'react-router-dom';
import { ArrowUpRight, Users } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { EmptyState } from '../../components/shared/EmptyState';
import { useParentChildren } from '../../hooks/use-parent';

const TAB_LABELS: Record<string, string> = {
  classes: 'Classes',
  attendance: 'Attendance',
  assignments: 'Assignments',
  worksheets: 'Worksheets',
  progress: 'Progress',
};

const statusColors: Record<string, 'success' | 'warning' | 'default' | 'danger'> = {
  ACTIVE: 'success',
  PENDING_APPROVAL: 'warning',
  INVITED: 'default',
  INACTIVE: 'default',
  SUSPENDED: 'danger',
};

export function ParentPickChildPage() {
  const location = useLocation();
  const { data: children = [], isLoading } = useParentChildren();

  // Derive which tab we're targeting from the URL path (/dashboard/parent/classes → "classes")
  const pathSegment = location.pathname.split('/').pop() ?? 'classes';
  const tab = TAB_LABELS[pathSegment] ? pathSegment : 'classes';
  const tabLabel = TAB_LABELS[tab] ?? 'Classes';

  return (
    <div className="space-y-6">
      <PageHeader
        title={tabLabel}
        subtitle="Select a child below to view their data"
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : children.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No children linked"
          description="Add your child's Student ID from the My Children page first."
          action={
            <Link to="/dashboard/parent/children">
              <Button variant="gradient">
                <Users className="h-4 w-4 mr-1.5" /> My Children
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {children.map((child) => {
            const fullName = `${child.firstName} ${child.lastName}`.trim() || 'Student';
            return (
              <div
                key={child.publicId}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={fullName} size="md" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{fullName}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{child.grade ?? '—'}</p>
                    </div>
                  </div>
                  <Badge variant={statusColors[child.status] ?? 'default'}>{child.status.replace('_', ' ')}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 py-2">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{child.attendanceRate}%</p>
                    <p className="text-[10px] text-gray-500">Attendance</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 py-2">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{child.totalClassesAttended}</p>
                    <p className="text-[10px] text-gray-500">Classes</p>
                  </div>
                </div>

                <Link
                  to={`/dashboard/parent/children/${child.publicId}?tab=${tab}`}
                  className="w-full"
                >
                  <Button size="sm" variant="gradient" fullWidth>
                    View {tabLabel} <ArrowUpRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
