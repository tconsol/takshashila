import { Link } from 'react-router-dom';
import { Users, BookOpen, CalendarDays, BarChart3, ArrowUpRight, UserPlus } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatsCard } from '../../components/shared/StatsCard';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { Spinner } from '../../components/ui/Loading';
import { EmptyState } from '../../components/shared/EmptyState';
import { useParentChildren, useChildClasses, useChildAttendance } from '../../hooks/use-parent';
import { useAuthStore } from '../../stores/auth.store';
import { format } from 'date-fns';


const attendanceColors: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
  PRESENT: 'success',
  ABSENT: 'danger',
  PARTIAL: 'warning',
  EXCUSED: 'default',
};

function ChildSummaryCard({ student }: { student: { publicId: string; userPublicId: string; firstName: string; lastName: string; attendanceRate: number; totalClassesAttended: number; grade?: string } }) {
  const { data: classes } = useChildClasses(student.publicId, { limit: '3', status: 'SCHEDULED' });
  const { data: attendance } = useChildAttendance(student.publicId, { limit: '5' });
  const fullName = `${student.firstName} ${student.lastName}`.trim() || 'Student';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={fullName} size="md" />
          <div>
            <p className="font-semibold text-gray-900 dark:text-white text-sm">
              {fullName}
            </p>
            {student.grade && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{student.grade}</p>
            )}
          </div>
        </div>
        <Link to={`/dashboard/parent/children/${student.publicId}`}>
          <Button size="sm" variant="outline">
            View Details <ArrowUpRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-center">
          <p className="text-2xl font-bold text-green-700 dark:text-green-400">{student.attendanceRate}%</p>
          <p className="text-xs text-green-600 dark:text-green-500">Attendance Rate</p>
        </div>
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 text-center">
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{student.totalClassesAttended}</p>
          <p className="text-xs text-blue-600 dark:text-blue-500">Classes Attended</p>
        </div>
      </div>

      {(classes?.items?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Upcoming Classes</p>
          <div className="space-y-1.5">
            {classes!.items.slice(0, 3).map((cls) => (
              <div key={cls.publicId} className="flex items-center justify-between text-sm rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2">
                <span className="font-medium text-gray-800 dark:text-gray-200 truncate">{cls.title}</span>
                <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                  {cls.startUTC ? format(new Date(cls.startUTC), 'MMM d') : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(attendance?.items?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Recent Attendance</p>
          <div className="flex flex-wrap gap-1.5">
            {attendance!.items.slice(0, 5).map((a) => (
              <Badge key={a.publicId} variant={attendanceColors[a.status] ?? 'default'}>
                {a.status}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ParentDashboard() {
  const { user } = useAuthStore();
  const { data: children = [], isLoading } = useParentChildren();

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title={`Welcome, ${user?.firstName ?? 'Parent'}`}
        subtitle="Monitor your children's learning progress"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Children Linked"
          value={children.length}
          icon={<Users className="h-5 w-5 text-brand-600" />}
        />
        <StatsCard
          title="Total Classes Attended"
          value={children.reduce((s, c) => s + (c.totalClassesAttended ?? 0), 0)}
          icon={<CalendarDays className="h-5 w-5 text-green-600" />}
          iconBg="bg-green-50 dark:bg-green-900/20"
        />
        <StatsCard
          title="Avg Attendance Rate"
          value={children.length > 0
            ? `${Math.round(children.reduce((s, c) => s + (c.attendanceRate ?? 0), 0) / children.length)}%`
            : '—'}
          icon={<BarChart3 className="h-5 w-5 text-violet-600" />}
          iconBg="bg-violet-50 dark:bg-violet-900/20"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>My Children</CardTitle>
            <Link to="/dashboard/parent/children">
              <Button size="sm" variant="outline">
                <UserPlus className="h-4 w-4 mr-1.5" /> Manage Children
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : children.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title="No children linked yet"
              description="Go to My Children to add your child's Student ID and start monitoring their progress."
              action={
                <Link to="/dashboard/parent/children">
                  <Button variant="gradient">
                    <UserPlus className="h-4 w-4 mr-1.5" /> Add Child
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {children.map((child) => (
                <ChildSummaryCard key={child.publicId} student={child} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'My Children', href: '/dashboard/parent/children', icon: Users, color: 'text-brand-600 bg-brand-50 dark:bg-brand-900/20' },
              { label: 'Classes', href: '/dashboard/parent/classes', icon: CalendarDays, color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
              { label: 'Assignments', href: '/dashboard/parent/assignments', icon: BookOpen, color: 'text-violet-600 bg-violet-50 dark:bg-violet-900/20' },
              { label: 'Progress', href: '/dashboard/parent/progress', icon: BarChart3, color: 'text-sky-600 bg-sky-50 dark:bg-sky-900/20' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-brand-300 hover:bg-brand-50/30 dark:hover:border-brand-700 transition-colors text-center"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
