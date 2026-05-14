import { useQuery } from '@tanstack/react-query';
import {
  Users, DollarSign, Activity, ShieldCheck, TrendingUp,
  Sparkles, ArrowUpRight, Server, Loader2,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatsCard } from '../../components/shared/StatsCard';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { analyticsService, type RoleCount } from '../../services/analytics.service';

const ROLE_ACCENTS: Record<string, string> = {
  STUDENT:     'bg-emerald-500',
  TUTOR:       'bg-sky-500',
  PRINCIPAL:   'bg-violet-500',
  SUPPORT:     'bg-amber-500',
  ADMIN:       'bg-rose-500',
  SUPER_ADMIN: 'bg-brand-500',
  PARENT:      'bg-pink-500',
};

const ROLE_LABELS: Record<string, string> = {
  STUDENT:     'Students',
  TUTOR:       'Tutors',
  PRINCIPAL:   'Principals',
  SUPPORT:     'Support',
  ADMIN:       'Admins',
  SUPER_ADMIN: 'Super Admins',
  PARENT:      'Parents',
};

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

export function SuperAdminDashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['super-admin-overview'],
    queryFn: analyticsService.getSuperAdminOverview,
    staleTime: 60_000,
  });

  const totalRevenue = data?.revenue30d.totalCents ?? 0;
  const tutorEarnings = data?.revenue30d.tutorEarningsCents ?? 0;
  const platformCommission = data?.revenue30d.platformCommissionCents ?? 0;

  const sorted = [...(data?.roleDistribution ?? [])].sort((a, b) => b.count - a.count);
  const totalRoleUsers = sorted.reduce((s, r) => s + r.count, 0);

  const revenueSplit: { label: string; cents: number; color: string }[] = totalRevenue > 0
    ? [
        { label: 'Platform Commission', cents: platformCommission, color: 'bg-brand-500' },
        { label: 'Tutor Earnings',      cents: tutorEarnings,     color: 'bg-emerald-500' },
      ]
    : [];

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

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Platform Console"
        title="Mission Control"
        description="Live view of platform health, revenue, governance and security signals."
        icon={<Sparkles className="h-5 w-5" />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Users"
          value={data?.totalUsers.toLocaleString() ?? '—'}
          accent="brand"
          icon={<Users className="h-5 w-5" />}
        />
        <StatsCard
          title="Revenue (30d)"
          value={formatCurrency(totalRevenue)}
          accent="green"
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatsCard
          title="Total Classes"
          value={data?.totalClasses.toLocaleString() ?? '—'}
          accent="sky"
          icon={<Activity className="h-5 w-5" />}
        />
        <StatsCard
          title="Tutor Earnings (30d)"
          value={formatCurrency(tutorEarnings)}
          accent="violet"
          icon={<ShieldCheck className="h-5 w-5" />}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Role Distribution</CardTitle>
              <p className="mt-1 text-xs text-gray-500">Total platform user base by role</p>
            </div>
            <Badge variant="brand" tone="soft">{totalRoleUsers.toLocaleString()} users</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sorted.map((r: RoleCount) => {
                const pct = totalRoleUsers > 0 ? Math.round((r.count / totalRoleUsers) * 100) : 0;
                return (
                  <div key={r.role}>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${ROLE_ACCENTS[r.role] ?? 'bg-gray-400'}`} />
                        <span className="font-medium text-gray-700 dark:text-gray-200">
                          {ROLE_LABELS[r.role] ?? r.role}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-gray-900 dark:text-white">{r.count.toLocaleString()}</span>
                        <span className="text-xs text-gray-400">{pct}%</span>
                      </div>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div className={`h-full ${ROLE_ACCENTS[r.role] ?? 'bg-gray-400'} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {sorted.length === 0 && (
                <p className="text-sm text-gray-400">No user data yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Revenue Breakdown</CardTitle>
              <p className="mt-1 text-xs text-gray-500">Last 30 days · {formatCurrency(totalRevenue)} total</p>
            </div>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {totalRevenue > 0 ? (
              <>
                <div className="mb-5 flex h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  {revenueSplit.map((r) => {
                    const pct = Math.round((r.cents / totalRevenue) * 100);
                    return <div key={r.label} className={r.color} style={{ width: `${pct}%` }} />;
                  })}
                </div>
                <div className="space-y-3">
                  {revenueSplit.map((r) => {
                    const pct = Math.round((r.cents / totalRevenue) * 100);
                    return (
                      <div key={r.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${r.color}`} />
                          <span className="text-sm text-gray-600 dark:text-gray-300">{r.label}</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(r.cents)}</span>
                          <span className="text-xs text-gray-400">({pct}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400">No revenue recorded in the last 30 days.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Recent Audit Events</CardTitle>
              <p className="mt-1 text-xs text-gray-500">Privileged actions across the platform</p>
            </div>
            <a href="/dashboard/super-admin/audit" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
              View all <ArrowUpRight className="h-3 w-3" />
            </a>
          </CardHeader>
          <CardContent>
            {data?.recentAuditEvents.length ? (
              <div className="space-y-3">
                {data.recentAuditEvents.map((e) => (
                  <div key={e.publicId} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 dark:border-gray-800">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{e.action}</p>
                      <p className="truncate text-xs text-gray-500">{e.actorId} · {e.actorRole}</p>
                    </div>
                    <Badge variant="info" tone="soft">{timeAgo(e.createdAt)}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No audit events recorded yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card tone="gradient" padding="lg">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 text-brand-600 ring-1 ring-brand-100 dark:bg-gray-900/60 dark:text-brand-300">
                <Server className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Infrastructure ops</h3>
                <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
                  Mongo, Redis and queue workers — check system console for live health status.
                </p>
              </div>
            </div>
            <a href="/dashboard/super-admin/system" className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50 dark:border-brand-800 dark:bg-gray-900 dark:text-brand-300 dark:hover:bg-gray-800">
              Open system console <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}
