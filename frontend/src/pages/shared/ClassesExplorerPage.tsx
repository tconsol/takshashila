import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Video, ChevronLeft, ChevronRight, CalendarCheck, XCircle, Undo2, Clock,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatsCard } from '../../components/shared/StatsCard';
import { Table } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { api } from '../../lib/axios';
import { analyticsService } from '../../services/analytics.service';

interface AdminClass {
  publicId: string;
  title: string;
  status: string;
  startUTC: string;
  endUTC: string;
  costCents: number;
  durationMinutes: number;
  classType: string;
  isRefunded?: boolean;
  autoResolution?: 'AUTO_COMPLETED' | 'AUTO_CANCELLED';
  tutorName: string;
  studentName: string;
}

interface Paginated {
  items: AdminClass[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

type Variant = 'success' | 'danger' | 'warning' | 'info' | 'default';

const STATUS_VARIANT: Record<string, Variant> = {
  COMPLETED: 'success',
  LIVE: 'warning',
  SCHEDULED: 'info',
  CANCELLED: 'danger',
  MISSED: 'default',
  RESCHEDULED: 'default',
  FAILED: 'danger',
};

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'LIVE', label: 'Live' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'MISSED', label: 'Missed' },
];

const WINDOW_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '', label: 'All time' },
];

const REFUND_OPTIONS = [
  { value: '', label: 'Refunded or not' },
  { value: 'true', label: 'Refunded only' },
  { value: 'false', label: 'Not refunded' },
];

function money(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/**
 * Platform-wide class browser. The admin list endpoint already existed but was
 * only ever used to feed the refunds tab — this exposes it properly so ops can
 * answer "what happened to this class" without a database console.
 */
export function ClassesExplorerPage() {
  const [status, setStatus] = useState('');
  const [days, setDays] = useState('30');
  const [refunded, setRefunded] = useState('');
  const [page, setPage] = useState(1);

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (status) params.set('status', status);
    if (days) params.set('days', days);
    if (refunded) params.set('refunded', refunded);
    return params.toString();
  }, [status, days, refunded, page]);

  const { data, isLoading } = useQuery<Paginated>({
    queryKey: ['admin-classes', query],
    queryFn: () => api.get(`/classes/admin/list?${query}`).then((r) => r.data.data),
    staleTime: 15_000,
  });

  const { data: classStats } = useQuery({
    queryKey: ['class-stats', Number(days) || 3650],
    queryFn: () => analyticsService.getClassStats(Number(days) || 3650),
    staleTime: 60_000,
  });

  const applyFilter = (fn: () => void) => { fn(); setPage(1); };

  const completionRate =
    classStats && classStats.booked > 0
      ? Math.round((classStats.completed / classStats.booked) * 100)
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes"
        eyebrow="Operations"
        description="Every class on the platform — who taught it, who attended, what it cost."
        icon={<Video className="h-5 w-5" />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          index={0}
          title="Booked"
          value={(classStats?.booked ?? 0).toLocaleString()}
          accent="brand"
          icon={<CalendarCheck className="h-5 w-5" />}
          hint={days ? `Last ${days} days` : 'All time'}
        />
        <StatsCard
          index={1}
          title="Completed"
          value={(classStats?.completed ?? 0).toLocaleString()}
          accent="green"
          icon={<CalendarCheck className="h-5 w-5" />}
          hint={completionRate !== null ? `${completionRate}% completion rate` : undefined}
        />
        <StatsCard
          index={2}
          title="Cancelled"
          value={(classStats?.cancelled ?? 0).toLocaleString()}
          accent="rose"
          icon={<XCircle className="h-5 w-5" />}
        />
        <StatsCard
          index={3}
          title="Showing"
          value={(data?.pagination.total ?? 0).toLocaleString()}
          accent="violet"
          icon={<Clock className="h-5 w-5" />}
          hint="Matching current filters"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Select options={STATUS_OPTIONS} value={status} onChange={(e) => applyFilter(() => setStatus(e.target.value))} />
        <Select options={WINDOW_OPTIONS} value={days} onChange={(e) => applyFilter(() => setDays(e.target.value))} />
        <Select options={REFUND_OPTIONS} value={refunded} onChange={(e) => applyFilter(() => setRefunded(e.target.value))} />
      </div>

      <Table<AdminClass>
        columns={[
          {
            key: 'title',
            header: 'Class',
            render: (c) => (
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{c.title}</p>
                <p className="truncate text-xs text-ink-muted">
                  {c.tutorName} → {c.studentName}
                </p>
              </div>
            ),
          },
          {
            key: 'startUTC',
            header: 'When',
            render: (c) => (
              <span className="whitespace-nowrap text-xs text-ink-muted">
                {format(new Date(c.startUTC), 'MMM d, yyyy h:mm a')}
                <span className="block text-ink-faint">{c.durationMinutes} min</span>
              </span>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (c) => (
              <div className="flex flex-col items-start gap-1">
                <Badge variant={STATUS_VARIANT[c.status] ?? 'default'} tone="soft">{c.status}</Badge>
                {c.autoResolution && (
                  <Badge
                    variant={c.autoResolution === 'AUTO_COMPLETED' ? 'info' : 'warning'}
                    tone="outline"
                  >
                    {c.autoResolution === 'AUTO_COMPLETED' ? 'Auto completed' : 'Auto cancelled'}
                  </Badge>
                )}
              </div>
            ),
          },
          {
            key: 'classType',
            header: 'Type',
            render: (c) => (
              <Badge variant={c.classType === 'DEMO' ? 'warning' : 'default'} tone="soft">
                {c.classType}
              </Badge>
            ),
          },
          {
            key: 'costCents',
            header: 'Charged',
            render: (c) => (
              <div className="flex items-center gap-1.5">
                <span className="font-semibold tabular-nums text-ink">{money(c.costCents)}</span>
                {c.isRefunded && (
                  <span title="Refunded"><Undo2 className="h-3.5 w-3.5 text-warn" /></span>
                )}
              </div>
            ),
          },
        ]}
        data={data?.items ?? []}
        keyField="publicId"
        loading={isLoading}
        dense
        emptyMessage="No classes match these filters."
      />

      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-muted">
            Page {data.pagination.page} of {data.pagination.totalPages} ·{' '}
            {data.pagination.total.toLocaleString()} classes
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= data.pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
