import { useQuery } from '@tanstack/react-query';
import {
  Headphones, Clock, CheckCircle2, AlertTriangle, ArrowUpRight, Inbox,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatsCard } from '../../components/shared/StatsCard';
import { EmptyState } from '../../components/shared/EmptyState';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { api } from '../../lib/axios';

interface Ticket {
  publicId: string;
  ticketNumber?: string;
  subject: string;
  requesterPublicId: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'ESCALATED' | 'RESOLVED' | 'CLOSED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  createdAt: string;
}

const STATUS_VARIANT = {
  OPEN: 'warning',
  IN_PROGRESS: 'info',
  ESCALATED: 'danger',
  RESOLVED: 'success',
  CLOSED: 'default',
} as const;

const PRIORITY_VARIANT = {
  URGENT: 'danger',
  HIGH: 'warning',
  MEDIUM: 'info',
  LOW: 'default',
} as const;

function useTickets() {
  return useQuery<Ticket[]>({
    queryKey: ['support', 'tickets'],
    queryFn: async () => {
      const { data } = await api.get('/support/tickets', { params: { limit: 10 } });
      return data?.data?.items ?? [];
    },
  });
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function SupportDashboard() {
  const { data: tickets = [], isLoading } = useTickets();

  const openCount       = tickets.filter((t) => t.status === 'OPEN').length;
  const inProgressCount = tickets.filter((t) => t.status === 'IN_PROGRESS').length;
  const escalatedCount  = tickets.filter((t) => t.status === 'ESCALATED').length;
  const resolvedCount   = tickets.filter((t) => t.status === 'RESOLVED').length;

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Support Center"
        title="Help Desk"
        description="Triage tickets, recover accounts and resolve escalations."
        icon={<Headphones className="h-5 w-5" />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Open Tickets"   value={String(openCount)}       accent="brand"  icon={<Inbox className="h-5 w-5" />} />
        <StatsCard title="In Progress"    value={String(inProgressCount)} accent="sky"    icon={<Clock className="h-5 w-5" />} />
        <StatsCard title="Resolved"       value={String(resolvedCount)}   accent="green"  icon={<CheckCircle2 className="h-5 w-5" />} hint="This view" />
        <StatsCard title="Escalated"      value={String(escalatedCount)}  accent="rose"   icon={<AlertTriangle className="h-5 w-5" />} />
      </div>

      <div className="mt-6">
        <Card padding="none">
          <div className="flex items-center justify-between border-b border-gray-200/70 px-5 py-4 dark:border-gray-800">
            <div>
              <CardTitle>Active Tickets</CardTitle>
              <p className="mt-1 text-xs text-gray-500">{tickets.length} tickets visible · sorted by newest</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="warning" tone="soft">{openCount} open</Badge>
              <Badge variant="danger" tone="soft" dot>{escalatedCount} escalated</Badge>
            </div>
          </div>
          <CardContent className="p-5">
            {isLoading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : tickets.length === 0 ? (
              <EmptyState
                icon={<Headphones className="h-6 w-6" />}
                title="No tickets yet"
                description="When users submit support requests they'll appear here for triage."
              />
            ) : (
              <div className="space-y-2.5">
                {tickets.map((t) => (
                  <div key={t.publicId} className="flex items-center justify-between rounded-xl border border-gray-100 p-3.5 transition-colors hover:border-brand-200 hover:bg-brand-50/30 dark:border-gray-800 dark:hover:border-brand-800/60 dark:hover:bg-brand-900/10">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {t.ticketNumber ?? t.publicId.slice(0, 8)}
                        </p>
                        <Badge variant={STATUS_VARIANT[t.status]} tone="soft">
                          {t.status.replace('_', ' ')}
                        </Badge>
                        {t.priority && (
                          <Badge variant={PRIORITY_VARIANT[t.priority]} tone="outline" size="sm">
                            {t.priority}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-gray-700 dark:text-gray-200">{t.subject}</p>
                      <p className="text-xs text-gray-500">{timeAgo(t.createdAt)} · {t.requesterPublicId.slice(0, 8)}</p>
                    </div>
                    <Link to={`/dashboard/support/tickets/${t.publicId}`}>
                      <Button size="sm" variant="outline">
                        Handle <ArrowUpRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
