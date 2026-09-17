import { useQuery } from '@tanstack/react-query';
import { Users, GraduationCap, UserCheck, TrendingUp, TrendingDown } from 'lucide-react';
import { PeopleDirectory } from '../../components/shared/PeopleDirectory';
import { StatsCard } from '../../components/shared/StatsCard';
import { adminUsersService } from '../../services/admin-users.service';

export function UserDirectoryPage() {
  const { data: counts } = useQuery({
    queryKey: ['user-counts'],
    queryFn: adminUsersService.counts,
    staleTime: 60_000,
  });

  const { data: students } = useQuery({
    queryKey: ['student-breakdown'],
    queryFn: adminUsersService.studentBreakdown,
    staleTime: 60_000,
  });

  const { data: growth } = useQuery({
    queryKey: ['user-growth', 30],
    queryFn: () => adminUsersService.growth(30),
    staleTime: 60_000,
  });

  const totalUsers = counts?.byRole.reduce((s, r) => s + r.count, 0) ?? 0;
  const activeCount = counts?.byStatus.find((s) => s.status === 'ACTIVE')?.count ?? 0;
  const suspendedCount = counts?.byStatus.find((s) => s.status === 'SUSPENDED')?.count ?? 0;
  const trendingDown = growth?.changePercent != null && growth.changePercent < 0;

  return (
    <PeopleDirectory
      title="User Directory"
      eyebrow="People"
      description="Every account on the platform — search, filter, inspect, edit and moderate."
      icon={<Users className="h-5 w-5" />}
      summary={
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            index={0}
            title="Total Users"
            value={totalUsers.toLocaleString()}
            accent="brand"
            icon={<Users className="h-5 w-5" />}
            hint={`${activeCount.toLocaleString()} active · ${suspendedCount.toLocaleString()} suspended`}
          />
          <StatsCard
            index={1}
            title="Students"
            value={(students?.total ?? 0).toLocaleString()}
            accent="green"
            icon={<GraduationCap className="h-5 w-5" />}
            hint={students ? `${students.withoutTutor.toLocaleString()} without a tutor` : undefined}
          />
          <StatsCard
            index={2}
            title="Avg Attendance"
            value={students ? `${students.avgAttendanceRate}%` : '—'}
            accent="sky"
            icon={<UserCheck className="h-5 w-5" />}
            hint={students ? `${students.totalClassesAttended.toLocaleString()} classes attended` : undefined}
          />
          <StatsCard
            index={3}
            title="Signups (30d)"
            value={(growth?.currentTotal ?? 0).toLocaleString()}
            accent={trendingDown ? 'rose' : 'violet'}
            icon={trendingDown ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
            hint={growth?.changePercent != null
              ? `${growth.changePercent >= 0 ? '+' : ''}${growth.changePercent}% vs previous 30d`
              : 'No prior window to compare'}
          />
        </div>
      }
    />
  );
}
