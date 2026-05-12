import { Users, CheckCircle2, DollarSign, Headphones, ArrowUpRight, ClipboardList } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatsCard } from '../../components/shared/StatsCard';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

const PENDING_PRINCIPALS = [
  { name: 'Priya Sharma',  email: 'priya@greenfield.edu',  applied: '2h ago' },
  { name: 'Arjun Mehta',   email: 'arjun@sunrise.edu',     applied: '1d ago' },
  { name: 'Sara Khan',     email: 'sara@horizons.edu',     applied: '2d ago' },
];

const ESCALATED = [
  { id: 'TKT-1042', issue: 'Payout dispute',     time: '2h ago', sev: 'danger'  as const },
  { id: 'TKT-1038', issue: 'Account recovery',   time: '5h ago', sev: 'warning' as const },
  { id: 'TKT-1031', issue: 'Refund request',     time: '1d ago', sev: 'warning' as const },
];

export function AdminDashboard() {
  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Operations"
        title="Admin Overview"
        description="Approve principals, moderate tutors and resolve operational escalations."
        icon={<ClipboardList className="h-5 w-5" />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Pending Approvals" value="14"     accent="amber"  icon={<CheckCircle2 className="h-5 w-5" />} hint="Across all institutions" />
        <StatsCard title="Active Principals" value="384"    accent="brand"  icon={<Users className="h-5 w-5" />}        change={{ value: '3 new this week', positive: true }} />
        <StatsCard title="Payouts Pending"   value="$23.4K" accent="green"  icon={<DollarSign className="h-5 w-5" />}    hint="Awaiting reconciliation" />
        <StatsCard title="Open Tickets"      value="37"     accent="rose"   icon={<Headphones className="h-5 w-5" />}    change={{ value: '5 escalated', positive: false }} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Principal Approval Queue</CardTitle>
              <p className="mt-1 text-xs text-gray-500">{PENDING_PRINCIPALS.length} waiting · oldest 2 days ago</p>
            </div>
            <Badge variant="warning" tone="soft">{PENDING_PRINCIPALS.length} pending</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {PENDING_PRINCIPALS.map((p) => (
                <div key={p.email} className="flex items-center justify-between rounded-xl border border-gray-100 p-3.5 transition-colors hover:border-brand-200 hover:bg-brand-50/30 dark:border-gray-800 dark:hover:border-brand-800/60 dark:hover:bg-brand-900/10">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-violet-100 text-xs font-semibold text-brand-700 dark:from-brand-900/40 dark:to-violet-900/40 dark:text-brand-300">
                      {p.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{p.name}</p>
                      <p className="truncate text-xs text-gray-500">{p.email} · {p.applied}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost">Review</Button>
                    <Button size="sm" variant="success">Approve</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Escalated Tickets</CardTitle>
              <p className="mt-1 text-xs text-gray-500">Tickets bumped from L1 support</p>
            </div>
            <Badge variant="danger" tone="soft" dot>5 escalated</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {ESCALATED.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-xl border border-gray-100 p-3.5 dark:border-gray-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{t.id}</p>
                      <Badge variant={t.sev} tone="soft">{t.sev === 'danger' ? 'URGENT' : 'HIGH'}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">{t.issue} · {t.time}</p>
                  </div>
                  <Button size="sm" variant="outline">
                    Handle <ArrowUpRight className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
