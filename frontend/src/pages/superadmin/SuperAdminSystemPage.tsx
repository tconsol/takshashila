import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Server, Database, Zap, Cpu, RefreshCw, Loader2,
  CheckCircle2, AlertTriangle, XCircle, Layers, Radio, Timer,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatsCard } from '../../components/shared/StatsCard';
import { IntegrationsPanel } from '../../components/shared/IntegrationsPanel';
import { FailedJobsModal } from '../../components/shared/FailedJobsModal';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { systemService, type HealthStatus } from '../../services/system.service';

const STATUS_META: Record<HealthStatus, {
  label: string;
  variant: 'success' | 'warning' | 'danger';
  icon: typeof CheckCircle2;
  ring: string;
}> = {
  ok:       { label: 'Operational', variant: 'success', icon: CheckCircle2,  ring: 'bg-ok' },
  degraded: { label: 'Degraded',    variant: 'warning', icon: AlertTriangle, ring: 'bg-warn' },
  down:     { label: 'Down',        variant: 'danger',  icon: XCircle,       ring: 'bg-danger' },
};

const COMPONENT_ICONS: Record<string, typeof Database> = {
  mongodb: Database,
  redis:   Zap,
};

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function SuperAdminSystemPage() {
  const [inspectingQueue, setInspectingQueue] = useState<string | null>(null);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['system-health'],
    queryFn: systemService.getHealth,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  // Pusher quota sits alongside process health — same cadence, separate endpoint.
  const { data: rt } = useQuery({
    queryKey: ['realtime-status'],
    queryFn: systemService.getRealtimeStatus,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="System Console" description="Live infrastructure health" icon={<Server className="h-5 w-5" />} />
        <div className="rounded-xl border border-danger/30 bg-danger-wash p-6 text-center text-sm text-danger">
          Could not reach the health endpoint — the API itself may be down.
          <span className="mt-1 block text-xs opacity-80">{(error as Error)?.message}</span>
        </div>
      </div>
    );
  }

  const overall = STATUS_META[data.status];
  const OverallIcon = overall.icon;
  const usedMemPct = Math.round(
    ((data.host.totalMemoryBytes - data.host.freeMemoryBytes) / data.host.totalMemoryBytes) * 100,
  );
  const totalFailedJobs = data.queues.reduce((s, q) => s + q.failed, 0);
  const totalPendingJobs = data.queues.reduce((s, q) => s + q.waiting + q.active + q.delayed, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Console"
        eyebrow="Infrastructure"
        description="Live health of the database, cache, background workers and the API process."
        icon={<Server className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-muted">
              Checked {new Date(data.checkedAt).toLocaleTimeString()}
            </span>
            <Button size="sm" variant="outline" onClick={() => refetch()} loading={isFetching}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        }
      />

      {/* Overall banner */}
      <Card padding="lg" className={data.status === 'ok' ? '' : 'border-warn/40'}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="relative flex h-12 w-12 items-center justify-center">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-20 ${overall.ring}`} />
              <span className={`relative flex h-12 w-12 items-center justify-center rounded-2xl text-white ${overall.ring}`}>
                <OverallIcon className="h-6 w-6" />
              </span>
            </span>
            <div>
              <h3 className="text-base font-semibold text-ink">
                All systems {overall.label.toLowerCase()}
              </h3>
              <p className="mt-0.5 text-sm text-ink-muted">
                {data.components.length} services · {data.queues.length} queues · auto-refresh every 15s
              </p>
            </div>
          </div>
          <Badge variant={overall.variant} tone="soft" dot>{overall.label}</Badge>
        </div>
      </Card>

      <IntegrationsPanel integrations={data.integrations ?? []} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          index={0}
          title="API Uptime"
          value={formatUptime(data.process.uptimeSeconds)}
          icon={<Server className="h-5 w-5" />}
          hint={`${data.process.env} · node ${data.process.nodeVersion}`}
        />
        <StatsCard
          index={1}
          title="Heap Used"
          value={formatBytes(data.process.memory.heapUsedBytes)}
          icon={<Cpu className="h-5 w-5" />}
          hint={`RSS ${formatBytes(data.process.memory.rssBytes)}`}
        />
        <StatsCard
          index={2}
          title="Jobs In Flight"
          value={totalPendingJobs.toLocaleString()}
          icon={<Layers className="h-5 w-5" />}
          hint="Waiting + active + delayed"
        />
        <StatsCard
          index={3}
          title="Failed Jobs"
          value={totalFailedJobs.toLocaleString()}
          icon={<AlertTriangle className="h-5 w-5" />}
          hint={totalFailedJobs > 0 ? 'Needs investigation' : 'Nothing failing'}
          change={totalFailedJobs > 0 ? { value: 'Needs investigation', positive: false } : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Services</CardTitle>
              <p className="mt-1 text-xs text-ink-muted">Datastore and cache reachability with round-trip latency</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {data.components.map((c) => {
                const meta = STATUS_META[c.status];
                const Icon = COMPONENT_ICONS[c.name] ?? Server;
                return (
                  <div
                    key={c.name}
                    className="flex items-center justify-between rounded-2xl border border-rule p-3.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-surface-sunk text-ink-2">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium capitalize text-ink">{c.name}</p>
                        {c.detail && <p className="truncate text-xs text-ink-muted">{c.detail}</p>}
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {c.latencyMs !== null && (
                        <span className="text-xs tabular-nums text-ink-muted">{c.latencyMs}ms</span>
                      )}
                      <Badge variant={meta.variant} tone="soft">{meta.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Background Queues</CardTitle>
              <p className="mt-1 text-xs text-ink-muted">BullMQ job counts per worker queue</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {data.queues.map((q) => {
                const meta = STATUS_META[q.status];
                return (
                  <div key={q.name} className="rounded-2xl border border-rule p-3.5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium capitalize text-ink">{q.name}</p>
                      <div className="flex items-center gap-2">
                        {q.failed > 0 && (
                          <Button size="sm" variant="ghost" onClick={() => setInspectingQueue(q.name)}>
                            Inspect
                          </Button>
                        )}
                        <Badge variant={meta.variant} tone="soft">{meta.label}</Badge>
                      </div>
                    </div>
                    {q.detail ? (
                      <p className="mt-1.5 truncate text-xs text-danger">{q.detail}</p>
                    ) : (
                      <div className="mt-2.5 grid grid-cols-5 gap-2 text-center">
                        {([
                          ['Waiting', q.waiting], ['Active', q.active], ['Delayed', q.delayed],
                          ['Failed', q.failed], ['Done', q.completed],
                        ] as const).map(([label, n]) => (
                          <div key={label}>
                            <p className={`text-sm font-semibold tabular-nums ${
                              label === 'Failed' && n > 0 ? 'text-danger' : 'text-ink'
                            }`}>
                              {n}
                            </p>
                            <p className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Request throughput and latency */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Request Latency</CardTitle>
              <p className="mt-1 text-xs text-ink-muted">
                Rolling window of {data.requests.latencyMs.sampleSize.toLocaleString()} requests
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {([['p50', data.requests.latencyMs.p50], ['p95', data.requests.latencyMs.p95], ['p99', data.requests.latencyMs.p99]] as const).map(
                ([label, value]) => (
                  <div key={label} className="rounded-xl border border-rule p-3 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
                    <p className={`mt-1 text-lg font-bold tabular-nums ${
                      value > 1000 ? 'text-danger' : value > 300 ? 'text-warn' : 'text-ink'
                    }`}>
                      {value}ms
                    </p>
                  </div>
                ),
              )}
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              {data.requests.requestsPerMinute.toLocaleString()} req/min since{' '}
              {new Date(data.requests.since).toLocaleTimeString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Errors & Status</CardTitle>
              <p className="mt-1 text-xs text-ink-muted">
                {data.requests.totalErrors.toLocaleString()} of {data.requests.totalRequests.toLocaleString()} returned 5xx
              </p>
            </div>
            <Badge
              variant={data.requests.errorRatePercent > 1 ? 'danger' : 'success'}
              tone="soft"
            >
              {data.requests.errorRatePercent}% errors
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {data.requests.statusCounts.length > 0 ? (
                data.requests.statusCounts.map((s) => (
                  <div key={s.status} className="flex items-center justify-between text-sm">
                    <span className={`font-mono ${
                      s.status >= 500 ? 'text-danger' : s.status >= 400 ? 'text-warn' : 'text-ok'
                    }`}>
                      {s.status}
                    </span>
                    <span className="tabular-nums text-ink-2">
                      {s.count.toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-ink-muted">No requests recorded yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Realtime</CardTitle>
              <p className="mt-1 text-xs text-ink-muted">
                {rt ? `Broadcasting over ${rt.transport === 'pusher' ? 'Pusher' : 'Socket.IO'}` : 'Transport and quota'}
              </p>
            </div>
            <Radio className={`h-4 w-4 ${rt?.transport === 'pusher' ? 'text-ok' : 'text-warn'}`} />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border border-rule p-3.5">
                <p className="eyebrow">Socket.IO</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-ink">
                  {data.realtime.connectedSockets ?? '—'}
                </p>
                <p className="text-[11px] text-ink-muted">{data.realtime.rooms ?? 0} rooms</p>
              </div>
              <div className="rounded border border-rule p-3.5">
                <p className="eyebrow">Pusher</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-ink">
                  {rt ? `${rt.connections}/${rt.maxConnections}` : '—'}
                </p>
                <p className="text-[11px] text-ink-muted">connection leases</p>
              </div>
            </div>

            {rt && (
              <div className="mt-4">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-ink-muted">Messages today</span>
                  <span className="font-semibold tabular-nums text-ink">
                    {rt.messagesToday.toLocaleString()} / {rt.maxDailyMessages.toLocaleString()}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunk">
                  <div
                    className={`h-full transition-all ${
                      rt.messagesAvailable ? 'bg-accent' : 'bg-danger'
                    }`}
                    style={{
                      width: `${Math.min(100, Math.round((rt.messagesToday / rt.maxDailyMessages) * 100))}%`,
                    }}
                  />
                </div>
                {!rt.configured && (
                  <p className="mt-2.5 text-xs text-ink-muted">
                    No Pusher credentials configured — everything runs on Socket.IO.
                  </p>
                )}
                {rt.breakerOpen && (
                  <p className="mt-2.5 text-xs text-danger">
                    Pusher paused: {rt.breakerReason}
                  </p>
                )}
                {rt.configured && !rt.breakerOpen && rt.transport === 'socket' && (
                  <p className="mt-2.5 text-xs text-warn">
                    {!rt.messagesAvailable
                      ? 'Daily message quota reached — falling back to Socket.IO until UTC midnight.'
                      : 'Connection limit reached — new clients get Socket.IO.'}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Slowest Routes</CardTitle>
              <p className="mt-1 text-xs text-ink-muted">Ranked by average response time</p>
            </div>
          </CardHeader>
          <CardContent>
            {data.requests.slowestRoutes.length > 0 ? (
              <div className="space-y-2">
                {data.requests.slowestRoutes.map((r) => (
                  <div key={r.route} className="flex items-center justify-between gap-3 rounded-xl border border-rule px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-ink-2">{r.route}</p>
                      <p className="text-[11px] text-ink-muted">
                        {r.count.toLocaleString()} calls
                        {r.errorCount > 0 ? ` · ${r.errorCount} errors` : ''}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-ink">{r.avgMs}ms</p>
                      <p className="text-[11px] text-ink-muted">max {r.maxMs}ms</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">No traffic recorded since the last restart.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Scheduled Jobs</CardTitle>
              <p className="mt-1 text-xs text-ink-muted">Repeatable jobs registered on the queues</p>
            </div>
            <Timer className="h-4 w-4 text-ink-muted" />
          </CardHeader>
          <CardContent>
            {data.scheduledJobs.length > 0 ? (
              <div className="space-y-2">
                {data.scheduledJobs.map((j) => (
                  <div key={`${j.queue}-${j.name}-${j.pattern}`} className="flex items-center justify-between gap-3 rounded-xl border border-rule px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-2">{j.name}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {j.queue}{j.pattern ? ` · ${j.pattern}` : ''}
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-xs text-ink-muted">
                      {j.nextRunAt ? `next ${new Date(j.nextRunAt).toLocaleString()}` : 'not scheduled'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">No repeatable jobs registered.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <FailedJobsModal queue={inspectingQueue} onClose={() => setInspectingQueue(null)} />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Host</CardTitle>
            <p className="mt-1 text-xs text-ink-muted">Machine running the API process</p>
          </div>
          <Badge variant="info" tone="soft">pid {data.process.pid}</Badge>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-muted">Platform</p>
              <p className="mt-1 text-sm font-medium text-ink">{data.host.platform}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-muted">CPU cores</p>
              <p className="mt-1 text-sm font-medium text-ink">{data.host.cpuCount}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-muted">Load avg (1m)</p>
              <p className="mt-1 text-sm font-medium text-ink">
                {data.host.loadAverage[0]?.toFixed(2) ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-muted">Memory used</p>
              <p className="mt-1 text-sm font-medium text-ink">
                {usedMemPct}% of {formatBytes(data.host.totalMemoryBytes)}
              </p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunk">
                <div
                  className={`h-full transition-all ${usedMemPct > 90 ? 'bg-danger' : usedMemPct > 75 ? 'bg-warn' : 'bg-ok'}`}
                  style={{ width: `${usedMemPct}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
