import { useQuery } from '@tanstack/react-query';
import { Building2, Users, GraduationCap, Percent } from 'lucide-react';
import { PeopleDirectory, type DirectoryRow } from '../../components/shared/PeopleDirectory';
import { StatsCard } from '../../components/shared/StatsCard';
import { Badge } from '../../components/ui/Badge';
import { principalsService } from '../../services/principals.service';

function num(profile: Record<string, unknown> | null, key: string): number {
  return Number(profile?.[key] ?? 0);
}

function money(cents: number) {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(1)}K`;
  return `$${dollars.toFixed(0)}`;
}

export function PrincipalsDirectoryPage() {
  // The principal listing carries the institution-level rollups the header needs.
  const { data } = useQuery({
    queryKey: ['principals', 'all', 'summary'],
    queryFn: () => principalsService.listAll({ limit: '100' }),
    staleTime: 60_000,
  });

  const principals = data?.items ?? [];
  const active = principals.filter((p) => p.status === 'ACTIVE').length;
  const pending = principals.filter((p) => p.status === 'PENDING_APPROVAL').length;
  const totalTutors = principals.reduce((s, p) => s + (p.totalTutors ?? 0), 0);
  const totalRevenue = principals.reduce((s, p) => s + (p.totalRevenueCents ?? 0), 0);

  return (
    <PeopleDirectory
      title="Principals"
      eyebrow="Institutions"
      description="Every institution owner on the platform — organizations, commission, reach."
      icon={<Building2 className="h-5 w-5" />}
      lockedRole="PRINCIPAL"
      summary={
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            index={0}
            title="Active Principals"
            value={active.toLocaleString()}
            accent="violet"
            icon={<Building2 className="h-5 w-5" />}
            hint={pending > 0 ? `${pending} awaiting approval` : 'None pending'}
          />
          <StatsCard
            index={1}
            title="Tutors Under Them"
            value={totalTutors.toLocaleString()}
            accent="sky"
            icon={<GraduationCap className="h-5 w-5" />}
          />
          <StatsCard
            index={2}
            title="Students Reached"
            value={principals.reduce((s, p) => s + (p.totalStudents ?? 0), 0).toLocaleString()}
            accent="green"
            icon={<Users className="h-5 w-5" />}
          />
          <StatsCard
            index={3}
            title="Institution Revenue"
            value={money(totalRevenue)}
            accent="brand"
            icon={<Percent className="h-5 w-5" />}
            hint="Lifetime, across all principals"
          />
        </div>
      }
      profileColumns={[
        {
          key: 'organizationName',
          header: 'Organization',
          render: (u: DirectoryRow) => (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                {(u.profile?.organizationName as string) || '—'}
              </p>
              {u.profile?.organizationWebsite ? (
                <p className="truncate text-xs text-slate-400">{u.profile.organizationWebsite as string}</p>
              ) : null}
            </div>
          ),
        },
        {
          key: 'reach',
          header: 'Reach',
          render: (u: DirectoryRow) => (
            <span className="text-xs text-slate-500">
              {num(u.profile, 'totalTutors')} tutors · {num(u.profile, 'totalStudents')} students
            </span>
          ),
        },
        {
          key: 'commissionRatePercent',
          header: 'Commission',
          render: (u: DirectoryRow) => (
            <Badge variant="info" tone="soft">{num(u.profile, 'commissionRatePercent')}%</Badge>
          ),
        },
      ]}
    />
  );
}
