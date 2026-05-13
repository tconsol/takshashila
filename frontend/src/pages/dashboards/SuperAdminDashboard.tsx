import {
  Users, DollarSign, Activity, ShieldCheck, TrendingUp, AlertTriangle,
  Sparkles, ArrowUpRight, Database, Server,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatsCard } from '../../components/shared/StatsCard';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

const ROLE_DISTRIBUTION = [
  { role: 'Students',   count: 9240, accent: 'bg-emerald-500', pct: 73 },
  { role: 'Tutors',     count: 2105, accent: 'bg-sky-500',     pct: 16 },
  { role: 'Principals', count: 384,  accent: 'bg-violet-500',  pct: 6 },
  { role: 'Support',    count: 106,  accent: 'bg-amber-500',   pct: 4 },
  { role: 'Admins',     count: 12,   accent: 'bg-rose-500',    pct: 1 },
];

const AUDIT_EVENTS = [
  { action: 'Admin role assigned',  actor: 'super_admin@takshashila.com', time: '2m ago',  type: 'info'    as const },
  { action: 'Tutor payout cleared', actor: 'admin@takshashila.com',       time: '15m ago', type: 'success' as const },
  { action: '5x failed login',      actor: 'unknown@x.com',               time: '1h ago',  type: 'danger'  as const },
  { action: 'Feature flag toggled', actor: 'super_admin@takshashila.com', time: '3h ago',  type: 'warning' as const },
];

const REVENUE_SPLIT = [
  { label: 'Platform Commission', value: '$142,160', pct: 50, color: 'bg-brand-500' },
  { label: 'Tutor Earnings',      value: '$99,512',  pct: 35, color: 'bg-emerald-500' },
  { label: 'Principal Share',     value: '$42,648',  pct: 15, color: 'bg-violet-500' },
];

const ALERTS = [
  { msg: 'Redis memory at 78%',        severity: 'warning' as const, icon: Database },
  { msg: '3 payouts awaiting review',  severity: 'info'    as const, icon: DollarSign },
  { msg: 'Demo abuse detected (2 IPs)',severity: 'danger'  as const, icon: ShieldCheck },
];

export function SuperAdminDashboard() {
  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Platform Console"
        title="Mission Control"
        description="Live view of platform health, revenue, governance and security signals."
        icon={<Sparkles className="h-5 w-5" />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Users"       value="12,847"  accent="brand"  icon={<Users className="h-5 w-5" />}        change={{ value: '12% MoM',  positive: true }} />
        <StatsCard title="Platform Revenue"  value="$284.3K" accent="green"  icon={<DollarSign className="h-5 w-5" />}   change={{ value: '8.2% MoM', positive: true }} />
        <StatsCard title="Active Sessions"   value="1,423"   accent="sky"    icon={<Activity className="h-5 w-5" />}     hint="Live across all regions" />
        <StatsCard title="System Health"     value="99.9%"   accent="violet" icon={<ShieldCheck className="h-5 w-5" />}  change={{ value: 'Uptime 30d', positive: true }} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Role Distribution</CardTitle>
              <p className="mt-1 text-xs text-gray-500">Total platform user base by role</p>
            </div>
            <Badge variant="brand" tone="soft">{ROLE_DISTRIBUTION.reduce((a, r) => a + r.count, 0).toLocaleString()} users</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {ROLE_DISTRIBUTION.map((r) => (
                <div key={r.role}>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${r.accent}`} />
                      <span className="font-medium text-gray-700 dark:text-gray-200">{r.role}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-gray-900 dark:text-white">{r.count.toLocaleString()}</span>
                      <span className="text-xs text-gray-400">{r.pct}%</span>
                    </div>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div className={`h-full ${r.accent} transition-all`} style={{ width: `${r.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card tone="soft">
          <CardHeader>
            <CardTitle>Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {ALERTS.map(({ msg, severity, icon: Icon }) => (
                <div key={msg} className="flex items-center gap-3 rounded-xl border border-gray-200/70 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
                  <Badge variant={severity} dot tone="soft" />
                  <Icon className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-200">{msg}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
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
            <div className="space-y-3">
              {AUDIT_EVENTS.map((e) => (
                <div key={e.action + e.time} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 dark:border-gray-800">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{e.action}</p>
                    <p className="truncate text-xs text-gray-500">{e.actor}</p>
                  </div>
                  <Badge variant={e.type} tone="soft">{e.time}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Revenue Breakdown</CardTitle>
              <p className="mt-1 text-xs text-gray-500">Last 30 days · $284,320 total</p>
            </div>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="mb-5 flex h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              {REVENUE_SPLIT.map((r) => (
                <div key={r.label} className={r.color} style={{ width: `${r.pct}%` }} />
              ))}
            </div>
            <div className="space-y-3">
              {REVENUE_SPLIT.map((r) => (
                <div key={r.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${r.color}`} />
                    <span className="text-sm text-gray-600 dark:text-gray-300">{r.label}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{r.value}</span>
                    <span className="text-xs text-gray-400">({r.pct}%)</span>
                  </div>
                </div>
              ))}
            </div>
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
                  Mongo, Redis and queue workers health checks pass across <span className="font-medium text-emerald-600">3 regions</span>.
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
