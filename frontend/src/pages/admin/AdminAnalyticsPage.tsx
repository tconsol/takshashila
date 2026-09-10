import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, Users, GraduationCap, CalendarCheck, UserCheck,
  DollarSign, ClipboardList, TrendingUp, TrendingDown,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatsCard } from '../../components/shared/StatsCard';
import { TrendChart } from '../../components/shared/TrendChart';
import { BarList } from '../../components/shared/BarList';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { analyticsService } from '../../services/analytics.service';
import { adminUsersService } from '../../services/admin-users.service';

const WINDOWS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

function money(cents: number) {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(1)}K`;
  return `$${dollars.toFixed(0)}`;
}

/**
 * Was a five-line stub rendering the thin shared page while the super-admin
 * dashboard got charts. This gives admins the same depth, with one time window
 * driving every panel so the numbers on screen always describe one period.
 */
export function AdminAnalyticsPage() {
  const [days, setDays] = useState('30');
  const period = Number(days);

  const { data: overview } = useQuery({
    queryKey: ['analytics', 'platform-overview'],
    queryFn: analyticsService.getPlatformOverview,
    staleTime: 60_000,
  });

  const { data: growth, isFetching: growthFetching } = useQuery({
    queryKey: ['user-growth', period],
    queryFn: () => adminUsersService.growth(period),
    staleTime: 60_000,
  });

  const { data: revenue, isFetching: revenueFetching } = useQuery({
    queryKey: ['revenue-series', period],
    queryFn: () => analyticsService.getRevenueSeries(period),
    staleTime: 60_000,
  });

  const { data: classStats } = useQuery({
    queryKey: ['class-stats', period],
    queryFn: () => analyticsService.getClassStats(period),
    staleTime: 60_000,
  });

  const { data: attendance } = useQuery({
    queryKey: ['attendance-stats', period],
    queryFn: () => analyticsService.getAttendanceStats(period),
    staleTime: 60_000,
  });

  const { data: assignments } = useQuery({
    queryKey: ['assignment-stats', period],
    queryFn: () => analyticsService.getAssignmentStats(period),
    staleTime: 60_000,
  });

  const { data: topTutors } = useQuery({
    queryKey: ['top-tutors', 8],
    queryFn: () => analyticsService.getTopTutors(8),
    staleTime: 60_000,
  });

  const { data: students } = useQuery({
    queryKey: ['student-breakdown'],
    queryFn: adminUsersService.studentBreakdown,
    staleTime: 60_000,
  });

  const trendingDown = growth?.changePercent != null && growth.changePercent < 0;
  const completionRate =
    classStats && classStats.booked > 0
      ? Math.round((classStats.completed / classStats.booked) * 100)
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Analytics"
        eyebrow="Insight"
        description="Growth, revenue, teaching activity and learning outcomes."
        icon={<BarChart3 className="h-5 w-5" />}
        actions={
          <Select
            options={WINDOWS}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="w-44"
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          index={0}
          title="Total Users"
          value={(overview?.totalUsers ?? 0).toLocaleString()}
          accent="brand"
          icon={<Users className="h-5 w-5" />}
          hint={overview ? `${(overview.activeUsers ?? 0).toLocaleString()} active` : undefined}
        />
        <StatsCard
          index={1}
          title={`Signups (${days}d)`}
          value={(growth?.currentTotal ?? 0).toLocaleString()}
          accent={trendingDown ? 'rose' : 'green'}
          icon={trendingDown ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
          hint={growth?.changePercent != null
            ? `${growth.changePercent >= 0 ? '+' : ''}${growth.changePercent}% vs prior ${days}d`
            : 'No prior window'}
        />
        <StatsCard
          index={2}
          title="Tutors"
          value={(overview?.totalTutors ?? 0).toLocaleString()}
          accent="sky"
          icon={<GraduationCap className="h-5 w-5" />}
          hint={overview ? `${(overview.totalStudents ?? 0).toLocaleString()} students` : undefined}
        />
        <StatsCard
          index={3}
          title="Lifetime Revenue"
          value={money(overview?.totalRevenueCents ?? 0)}
          accent="violet"
          icon={<DollarSign className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>New Signups</CardTitle>
              <p className="mt-1 text-xs text-ink-muted">Daily account creations</p>
            </div>
            {growth?.changePercent != null && (
              <Badge variant={growth.changePercent >= 0 ? 'success' : 'danger'} tone="soft">
                {growth.changePercent >= 0 ? '+' : ''}{growth.changePercent}%
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            <TrendChart
              data={(growth?.series ?? []).map((p) => ({ date: p.date, value: p.total }))}
              seriesLabel="Signups"
              isFetching={growthFetching}
              emptyMessage={`No signups in the last ${days} days.`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Daily Revenue</CardTitle>
              <p className="mt-1 text-xs text-ink-muted">Credits spent per day</p>
            </div>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={(revenue ?? []).map((p) => ({ date: p._id, value: p.totalCents }))}
              seriesLabel="Revenue"
              isFetching={revenueFetching}
              formatValue={money}
              emptyMessage={`No revenue in the last ${days} days.`}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          index={0}
          title="Classes Booked"
          value={(classStats?.booked ?? 0).toLocaleString()}
          accent="brand"
          icon={<CalendarCheck className="h-5 w-5" />}
          hint={classStats ? `${classStats.cancelled.toLocaleString()} cancelled` : undefined}
        />
        <StatsCard
          index={1}
          title="Completion Rate"
          value={completionRate !== null ? `${completionRate}%` : '—'}
          accent="green"
          icon={<CalendarCheck className="h-5 w-5" />}
          hint={classStats ? `${classStats.completed.toLocaleString()} completed` : undefined}
        />
        <StatsCard
          index={2}
          title="Attendance Rate"
          value={attendance ? `${attendance.rate}%` : '—'}
          accent="sky"
          icon={<UserCheck className="h-5 w-5" />}
          hint={attendance ? `${attendance.present.toLocaleString()} of ${attendance.total.toLocaleString()} present` : undefined}
        />
        <StatsCard
          index={3}
          title="Assignments"
          value={(assignments?.published ?? 0).toLocaleString()}
          accent="amber"
          icon={<ClipboardList className="h-5 w-5" />}
          hint={assignments ? `${assignments.graded.toLocaleString()} graded` : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Top Tutors</CardTitle>
              <p className="mt-1 text-xs text-ink-muted">Ranked by classes completed all-time</p>
            </div>
          </CardHeader>
          <CardContent>
            <BarList
              items={(topTutors ?? []).map((t) => ({
                label: t.name,
                sublabel: [t.subjects.slice(0, 2).join(', '), t.revenueCents > 0 ? money(t.revenueCents) : null]
                  .filter(Boolean).join(' · ') || undefined,
                value: t.classesCompleted,
              }))}
              emptyMessage="No completed classes yet."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Students by Grade</CardTitle>
              <p className="mt-1 text-xs text-ink-muted">
                {students ? `${students.total.toLocaleString()} students · ${students.avgAttendanceRate}% average attendance` : 'Cohort spread'}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <BarList
              items={(students?.byGrade ?? []).map((g) => ({ label: g.grade, value: g.count }))}
              emptyMessage="No grades recorded."
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Assignment Funnel</CardTitle>
            <p className="mt-1 text-xs text-ink-muted">Published → submitted → graded over the last {days} days</p>
          </div>
        </CardHeader>
        <CardContent>
          <BarList
            max={assignments?.published || undefined}
            items={assignments
              ? [
                  { label: 'Published', value: assignments.published },
                  { label: 'Submitted', value: assignments.submitted },
                  { label: 'Graded', value: assignments.graded },
                ]
              : []}
            emptyMessage="No assignment activity in this period."
          />
          {assignments && assignments.submitted > 0 && (
            <p className="mt-4 text-xs text-ink-muted">
              {Math.round((assignments.graded / assignments.submitted) * 100)}% of submissions graded.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
