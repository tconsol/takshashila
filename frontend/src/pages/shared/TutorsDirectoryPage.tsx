import { useQuery } from '@tanstack/react-query';
import { GraduationCap, Star, BadgeCheck, CalendarCheck } from 'lucide-react';
import { PeopleDirectory, type DirectoryRow } from '../../components/shared/PeopleDirectory';
import { StatsCard } from '../../components/shared/StatsCard';
import { Badge } from '../../components/ui/Badge';
import { adminUsersService } from '../../services/admin-users.service';
import { analyticsService } from '../../services/analytics.service';

function num(profile: Record<string, unknown> | null, key: string): number {
  return Number(profile?.[key] ?? 0);
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

export function TutorsDirectoryPage() {
  const { data: counts } = useQuery({
    queryKey: ['user-counts'],
    queryFn: adminUsersService.counts,
    staleTime: 60_000,
  });

  const { data: topTutors } = useQuery({
    queryKey: ['top-tutors', 1],
    queryFn: () => analyticsService.getTopTutors(1),
    staleTime: 60_000,
  });

  const { data: classStats } = useQuery({
    queryKey: ['class-stats', 30],
    queryFn: () => analyticsService.getClassStats(30),
    staleTime: 60_000,
  });

  const tutorCount = counts?.byRole.find((r) => r.role === 'TUTOR')?.count ?? 0;
  const best = topTutors?.[0];

  return (
    <PeopleDirectory
      title="Tutors"
      eyebrow="Teaching staff"
      description="Every tutor on the platform — subjects, rates, verification and teaching load."
      icon={<GraduationCap className="h-5 w-5" />}
      lockedRole="TUTOR"
      summary={
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            index={0}
            title="Total Tutors"
            value={tutorCount.toLocaleString()}
            accent="sky"
            icon={<GraduationCap className="h-5 w-5" />}
          />
          <StatsCard
            index={1}
            title="Classes Completed (30d)"
            value={(classStats?.completed ?? 0).toLocaleString()}
            accent="green"
            icon={<CalendarCheck className="h-5 w-5" />}
            hint={classStats ? `${classStats.cancelled.toLocaleString()} cancelled` : undefined}
          />
          <StatsCard
            index={2}
            title="Top Tutor"
            value={best ? best.name.split(' ')[0] : '—'}
            accent="violet"
            icon={<Star className="h-5 w-5" />}
            hint={best ? `${best.classesCompleted.toLocaleString()} classes completed` : 'No completed classes yet'}
          />
          <StatsCard
            index={3}
            title="Suspended"
            value={(counts?.byStatus.find((s) => s.status === 'SUSPENDED')?.count ?? 0).toLocaleString()}
            accent="rose"
            icon={<BadgeCheck className="h-5 w-5" />}
            hint="Across all roles"
          />
        </div>
      }
      profileColumns={[
        {
          key: 'subjects',
          header: 'Subjects',
          render: (u: DirectoryRow) => {
            const subjects = (u.profile?.subjects as string[] | undefined) ?? [];
            return subjects.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {subjects.slice(0, 3).map((s) => (
                  <Badge key={s} variant="info" tone="soft">{s}</Badge>
                ))}
                {subjects.length > 3 && (
                  <span className="text-xs text-slate-400">+{subjects.length - 3}</span>
                )}
              </div>
            ) : (
              <span className="text-xs text-slate-400">None set</span>
            );
          },
        },
        {
          key: 'rate',
          header: 'Rate / Commission',
          render: (u: DirectoryRow) => (
            <span className="text-xs text-slate-500">
              {money(num(u.profile, 'hourlyRateCents'))}/hr · {num(u.profile, 'commissionRatePercent')}%
            </span>
          ),
        },
        {
          key: 'teaching',
          header: 'Teaching',
          render: (u: DirectoryRow) => (
            <span className="text-xs text-slate-500">
              {num(u.profile, 'totalClassesCompleted')} classes · {num(u.profile, 'totalStudents')} students
              {u.profile?.isVerified ? ' · verified' : ''}
            </span>
          ),
        },
      ]}
    />
  );
}
