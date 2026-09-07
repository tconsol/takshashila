import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users, CheckCircle2, DollarSign, Headphones, ArrowUpRight, ClipboardList, Loader2,
  UserCheck, CalendarCheck, GraduationCap,
} from 'lucide-react';
import { DashboardHero } from '../../components/shared/DashboardHero';
import { StatsCard } from '../../components/shared/StatsCard';
import { TrendChart } from '../../components/shared/TrendChart';
import { BarList } from '../../components/shared/BarList';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { analyticsService } from '../../services/analytics.service';
import { adminUsersService } from '../../services/admin-users.service';
import { useApprovePrincipal } from '../../hooks/use-principals';

function formatCurrency(cents: number) {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(1)}K`;
  return `$${dollars.toFixed(0)}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const PRIORITY_VARIANT: Record<string, 'danger' | 'warning'> = {
  URGENT: 'danger',
  HIGH:   'warning',
};

export function AdminDashboard() {
  const navigate = useNavigate();
  const { mutateAsync: approve, isPending: approving } = useApprovePrincipal();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: analyticsService.getAdminOverview,
    staleTime: 30_000,
  });

  const { data: growth, isFetching: growthFetching } = useQuery({
    queryKey: ['user-growth', 30],
    queryFn: () => adminUsersService.growth(30),
    staleTime: 60_000,
  });

  const { data: students } = useQuery({
    queryKey: ['student-breakdown'],
    queryFn: adminUsersService.studentBreakdown,
    staleTime: 60_000,
  });

  const { data: classStats } = useQuery({
    queryKey: ['class-stats', 30],
    queryFn: () => analyticsService.getClassStats(30),
    staleTime: 60_000,
  });

  const { data: attendanceStats } = useQuery({
    queryKey: ['attendance-stats', 30],
    queryFn: () => analyticsService.getAttendanceStats(30),
    staleTime: 60_000,
  });

  const { data: topTutors } = useQuery({
    queryKey: ['top-tutors', 6],
    queryFn: () => analyticsService.getTopTutors(6),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-600 dark:border-rose-800 dark:bg-rose-900/20">
        Failed to load dashboard data. Please refresh.
      </div>
    );
  }

  const stats = data?.stats;
  const pendingList = data?.pendingPrincipalsList ?? [];
  const urgentList = data?.urgentTicketsList ?? [];

  return (
    <div className="space-y-6">
      <DashboardHero
        role="ADMIN"
        eyebrow="Operations"
        title="Admin Overview"
        description="Approve principals, moderate tutors and resolve operational escalations."
        icon={<ClipboardList className="h-6 w-6" />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          index={0}
          title="Pending Approvals"
          value={stats?.pendingApprovals.toLocaleString() ?? ''}
          accent="amber"
          icon={<CheckCircle2 className="h-5 w-5" />}
          hint="Principal applications waiting"
        />
        <StatsCard
          index={1}
          title="Active Principals"
          value={stats?.activePrincipals.toLocaleString() ?? ''}
          accent="brand"
          icon={<Users className="h-5 w-5" />}
        />
        <StatsCard
          index={2}
          title="Payouts Pending"
          value={formatCurrency(stats?.payoutsPendingCents ?? 0)}
          accent="green"
          icon={<DollarSign className="h-5 w-5" />}
          hint="Awaiting reconciliation"
        />
        <StatsCard
          index={3}
          title="Open Tickets"
          value={stats?.openTickets.toLocaleString() ?? ''}
          accent="rose"
          icon={<Headphones className="h-5 w-5" />}
          hint={stats?.highPriorityTickets ? `${stats.highPriorityTickets} high priority` : undefined}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          index={0}
          title="Students"
          value={(students?.total ?? 0).toLocaleString()}
          accent="green"
          icon={<GraduationCap className="h-5 w-5" />}
          hint={students ? `${students.withoutTutor.toLocaleString()} without a tutor` : undefined}
        />
        <StatsCard
          index={1}
          title="Attendance Rate"
          value={attendanceStats ? `${attendanceStats.rate}%` : '—'}
          accent="sky"
          icon={<UserCheck className="h-5 w-5" />}
          hint="Last 30 days"
        />
        <StatsCard
          index={2}
          title="Classes Booked (30d)"
          value={(classStats?.booked ?? 0).toLocaleString()}
          accent="violet"
          icon={<CalendarCheck className="h-5 w-5" />}
          hint={classStats ? `${classStats.cancelled.toLocaleString()} cancelled` : undefined}
        />
        <StatsCard
          index={3}
          title="Signups (30d)"
          value={(growth?.currentTotal ?? 0).toLocaleString()}
          accent="brand"
          icon={<Users className="h-5 w-5" />}
          hint={growth?.changePercent != null
            ? `${growth.changePercent >= 0 ? '+' : ''}${growth.changePercent}% vs prior 30d`
            : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>New Signups</CardTitle>
              <p className="mt-1 text-xs text-gray-500">Daily account creations, last 30 days</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => navigate('/dashboard/admin/users')}>
              User directory <ArrowUpRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={(growth?.series ?? []).map((p) => ({ date: p.date, value: p.total }))}
              seriesLabel="Signups"
              isFetching={growthFetching}
              emptyMessage="No signups in the last 30 days."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Top Tutors</CardTitle>
              <p className="mt-1 text-xs text-gray-500">Ranked by classes completed all-time</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => navigate('/dashboard/admin/tutors')}>
              All tutors <ArrowUpRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            <BarList
              items={(topTutors ?? []).map((t) => ({
                label: t.name,
                sublabel: t.subjects.slice(0, 2).join(', ') || undefined,
                value: t.classesCompleted,
              }))}
              emptyMessage="No completed classes yet."
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Principal Approval Queue</CardTitle>
              <p className="mt-1 text-xs text-gray-500">
                {pendingList.length > 0
                  ? `${pendingList.length} shown · oldest ${timeAgo(pendingList[pendingList.length - 1]?.appliedAt ?? '')}`
                  : 'No pending applications'}
              </p>
            </div>
            <Badge variant="warning" tone="soft">{stats?.pendingApprovals ?? 0} pending</Badge>
          </CardHeader>
          <CardContent>
            {pendingList.length > 0 ? (
              <div className="space-y-2.5">
                {pendingList.map((p) => (
                  <div
                    key={p.publicId}
                    className="flex items-center justify-between rounded-2xl border border-gray-100 p-3.5 transition-colors hover:border-brand-200 hover:bg-brand-50/30 dark:border-gray-800 dark:hover:border-brand-800/60 dark:hover:bg-brand-900/10"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-violet-100 text-xs font-semibold text-brand-700 dark:from-brand-900/40 dark:to-violet-900/40 dark:text-brand-300">
                        {p.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{p.name}</p>
                        <p className="truncate text-xs text-gray-500">
                          {p.email} · {timeAgo(p.appliedAt)}
                          {p.organizationName ? ` · ${p.organizationName}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate('/dashboard/admin/principals')}
                      >
                        Review
                      </Button>
                      <Button
                        size="sm"
                        variant="success"
                        loading={approving}
                        onClick={() => approve(p.publicId)}
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-gray-400">No pending principal applications.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>High Priority Tickets</CardTitle>
              <p className="mt-1 text-xs text-gray-500">Urgent and high priority open tickets</p>
            </div>
            <Badge variant="danger" tone="soft" dot>{stats?.highPriorityTickets ?? 0} urgent/high</Badge>
          </CardHeader>
          <CardContent>
            {urgentList.length > 0 ? (
              <div className="space-y-2.5">
                {urgentList.map((t) => (
                  <div key={t.publicId} className="flex items-center justify-between rounded-2xl border border-gray-100 p-3.5 dark:border-gray-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[180px]">{t.subject}</p>
                        <Badge variant={PRIORITY_VARIANT[t.priority] ?? 'warning'} tone="soft">{t.priority}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">{t.category} · {timeAgo(t.createdAt)}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('/dashboard/admin/support')}
                    >
                      Handle <ArrowUpRight className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-gray-400">No urgent tickets right now.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
