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

function ChildSummaryCard({ student }: {
  student: {
    publicId: string;
    userPublicId: string;
    firstName: string;
    lastName: string;
    attendanceRate: number;
    totalClassesAttended: number;
    grade?: string;
  };
}) {
  const { data: classes } = useChildClasses(student.publicId, { limit: '3', status: 'SCHEDULED' });
  const { data: attendance } = useChildAttendance(student.publicId, { limit: '5' });
  const fullName = `${student.firstName} ${student.lastName}`.trim() || 'Student';

  return (
    <div className="flex flex-col gap-4 rounded-[28px] border-2.5 border-clay-ink bg-clay-surface p-5 shadow-clay">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={fullName} size="md" />
          <div>
            <p className="text-sm font-black text-clay-ink">{fullName}</p>
            {student.grade && (
              <p className="text-xs text-clay-muted">{student.grade}</p>
            )}
          </div>
        </div>
        <Link to={`/dashboard/parent/children/${student.publicId}`}>
          <Button size="sm" variant="secondary">
            View <ArrowUpRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-2xl border-2 border-clay-ink/10 bg-clay-mint/40 py-2">
          <p className="text-lg font-black text-clay-ink">{student.attendanceRate}%</p>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-clay-muted">Attendance</p>
        </div>
        <div className="rounded-2xl border-2 border-clay-ink/10 bg-clay-sky/40 py-2">
          <p className="text-lg font-black text-clay-ink">{student.totalClassesAttended}</p>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-clay-muted">Classes</p>
        </div>
      </div>

      {/* Upcoming classes */}
      {(classes?.items?.length ?? 0) > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-clay-muted">Upcoming Classes</p>
          <div className="space-y-1.5">
            {classes!.items.slice(0, 3).map((cls) => (
              <div
                key={cls.publicId}
                className="flex items-center justify-between rounded-xl border-2 border-clay-ink/10 bg-clay-bg px-3 py-2"
              >
                <span className="truncate text-xs font-bold text-clay-ink">{cls.title}</span>
                <span className="ml-2 shrink-0 text-[11px] font-semibold text-clay-muted">
                  {cls.startUTC ? format(new Date(cls.startUTC), 'MMM d') : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent attendance */}
      {(attendance?.items?.length ?? 0) > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-clay-muted">Recent Attendance</p>
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

const QUICK_LINKS = [
  { label: 'My Children',  href: '/dashboard/parent/children',    Icon: Users,       bg: 'bg-clay-purple', },
  { label: 'Classes',      href: '/dashboard/parent/classes',     Icon: CalendarDays, bg: 'bg-clay-mint',  },
  { label: 'Assignments',  href: '/dashboard/parent/assignments', Icon: BookOpen,    bg: 'bg-clay-sky',   },
  { label: 'Progress',     href: '/dashboard/parent/progress',    Icon: BarChart3,   bg: 'bg-clay-yellow',},
];

export function ParentDashboard() {
  const { user } = useAuthStore();
  const { data: children = [], isLoading } = useParentChildren();

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title={`Welcome, ${user?.firstName ?? 'Parent'}`}
        subtitle="Monitor your children's learning progress"
      />

      {/* Stats */}
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

      {/* My Children */}
      <Card>
        <CardHeader>
          <CardTitle>My Children</CardTitle>
          <Link to="/dashboard/parent/children">
            <Button size="sm" variant="outline">
              <UserPlus className="h-4 w-4 mr-1.5" /> Manage Children
            </Button>
          </Link>
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

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {QUICK_LINKS.map(({ label, href, Icon, bg }) => (
              <Link
                key={href}
                to={href}
                className="flex flex-col items-center gap-3 rounded-[28px] border-2.5 border-clay-ink bg-clay-surface p-5 shadow-clay transition-all hover:-translate-y-0.5 hover:shadow-clay-lg text-center"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border-2.5 border-clay-ink ${bg} shadow-clay-sm`}>
                  <Icon className="h-5 w-5 text-clay-ink" />
                </div>
                <span className="text-xs font-extrabold text-clay-ink">{label}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
