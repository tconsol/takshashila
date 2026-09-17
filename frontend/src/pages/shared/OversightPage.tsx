import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ShieldAlert, Search, Trash2, RotateCcw, FileText, ClipboardList,
  FolderOpen, Mail, Sparkles, ChevronLeft, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatsCard } from '../../components/shared/StatsCard';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { Tabs } from '../../components/ui/Tabs';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import {
  oversightService, type ContentItem, type ContentKind, type AdminDemoRequest,
} from '../../services/oversight.service';

const TABS = [
  { key: 'content', label: 'Content' },
  { key: 'demo', label: 'Demo Requests' },
  { key: 'email', label: 'Email Delivery' },
];

const KIND_OPTIONS = [
  { value: '', label: 'All content' },
  { value: 'worksheet', label: 'Worksheets' },
  { value: 'assignment', label: 'Assignments' },
  { value: 'resource', label: 'Resources' },
];

const DEMO_STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'REJECTED', label: 'Rejected' },
];

const KIND_ICON: Record<ContentKind, typeof FileText> = {
  worksheet: FileText,
  assignment: ClipboardList,
  resource: FolderOpen,
};

type Variant = 'success' | 'danger' | 'warning' | 'info' | 'default';

const DEMO_VARIANT: Record<string, Variant> = {
  PENDING: 'warning',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  EXPIRED: 'default',
};

/**
 * Oversight of things admins need to see but do not author: tutor content,
 * demo requests across the platform, and whether outbound email is landing.
 */
export function OversightPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('content');

  // ── Content ───────────────────────────────────────────────────────────────
  const [kind, setKind] = useState('');
  const [search, setSearch] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [contentPage, setContentPage] = useState(1);
  const [removing, setRemoving] = useState<ContentItem | null>(null);

  const { data: content, isLoading: contentLoading } = useQuery({
    queryKey: ['oversight-content', kind, search, includeDeleted, contentPage],
    queryFn: () => oversightService.listContent({ kind, q: search, includeDeleted, page: contentPage }),
    enabled: tab === 'content',
    staleTime: 15_000,
  });

  const { data: counts } = useQuery({
    queryKey: ['content-counts'],
    queryFn: oversightService.contentCounts,
    staleTime: 60_000,
  });

  const invalidateContent = () => {
    qc.invalidateQueries({ queryKey: ['oversight-content'] });
    qc.invalidateQueries({ queryKey: ['content-counts'] });
  };

  const {
    mutate: remove, isPending: removingPending, error: removeError, reset: resetRemove,
  } = useMutation({
    mutationFn: ({ item, reason }: { item: ContentItem; reason?: string }) =>
      oversightService.removeContent(item.kind, item.publicId, reason),
    onSuccess: () => { invalidateContent(); setRemoving(null); },
  });

  const { mutate: restore, isPending: restoring } = useMutation({
    mutationFn: (item: ContentItem) => oversightService.restoreContent(item.kind, item.publicId),
    onSuccess: invalidateContent,
  });

  // ── Demo requests ─────────────────────────────────────────────────────────
  const [demoStatus, setDemoStatus] = useState('');
  const [demoPage, setDemoPage] = useState(1);

  const { data: demos, isLoading: demosLoading } = useQuery({
    queryKey: ['oversight-demos', demoStatus, demoPage],
    queryFn: () => oversightService.demoRequests(demoStatus, demoPage),
    enabled: tab === 'demo',
    staleTime: 15_000,
  });

  const { data: demoCounts } = useQuery({
    queryKey: ['demo-counts'],
    queryFn: oversightService.demoRequestCounts,
    staleTime: 60_000,
  });

  // ── Email ─────────────────────────────────────────────────────────────────
  const { data: email } = useQuery({
    queryKey: ['email-stats', 7],
    queryFn: () => oversightService.emailStats(7),
    enabled: tab === 'email',
    staleTime: 60_000,
  });

  const applyContentFilter = (fn: () => void) => { fn(); setContentPage(1); };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Oversight"
        eyebrow="Moderation"
        description="Tutor content, demo requests across the platform, and outbound email health."
        icon={<ShieldAlert className="h-5 w-5" />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          index={0}
          title="Worksheets"
          value={(counts?.worksheets ?? 0).toLocaleString()}
          accent="brand"
          icon={<FileText className="h-5 w-5" />}
        />
        <StatsCard
          index={1}
          title="Assignments"
          value={(counts?.assignments ?? 0).toLocaleString()}
          accent="violet"
          icon={<ClipboardList className="h-5 w-5" />}
        />
        <StatsCard
          index={2}
          title="Resources"
          value={(counts?.resources ?? 0).toLocaleString()}
          accent="sky"
          icon={<FolderOpen className="h-5 w-5" />}
        />
        <StatsCard
          index={3}
          title="Demo Requests"
          value={(demoCounts?.reduce((s, d) => s + d.count, 0) ?? 0).toLocaleString()}
          accent="amber"
          icon={<Sparkles className="h-5 w-5" />}
          hint={demoCounts?.find((d) => d.status === 'PENDING')
            ? `${demoCounts.find((d) => d.status === 'PENDING')!.count} pending`
            : undefined}
        />
      </div>

      <Tabs tabs={TABS} activeTab={tab} onChange={setTab} />

      {tab === 'content' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              placeholder="Search by title…"
              leftIcon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => applyContentFilter(() => setSearch(e.target.value))}
            />
            <Select options={KIND_OPTIONS} value={kind} onChange={(e) => applyContentFilter(() => setKind(e.target.value))} />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(e) => applyContentFilter(() => setIncludeDeleted(e.target.checked))}
                className="h-4 w-4 rounded border-rule-strong text-accent focus:ring-accent"
              />
              Include removed
            </label>
          </div>

          <Table<ContentItem>
            columns={[
              {
                key: 'title',
                header: 'Content',
                render: (c) => {
                  const Icon = KIND_ICON[c.kind];
                  return (
                    <div className="flex items-start gap-2.5">
                      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-muted" />
                      <div className="min-w-0">
                        <p className={`truncate font-medium ${c.isDeleted ? 'text-ink-muted line-through' : 'text-ink'}`}>
                          {c.title}
                        </p>
                        <p className="truncate text-xs text-ink-muted">
                          {c.tutorName}{c.detail ? ` · ${c.detail}` : ''}
                        </p>
                      </div>
                    </div>
                  );
                },
              },
              {
                key: 'kind',
                header: 'Type',
                render: (c) => <Badge variant="info" tone="soft">{c.kind}</Badge>,
              },
              {
                key: 'createdAt',
                header: 'Created',
                render: (c) => (
                  <span className="whitespace-nowrap text-xs text-ink-muted">
                    {format(new Date(c.createdAt), 'MMM d, yyyy')}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: '',
                render: (c) => (
                  <div className="flex justify-end">
                    {c.isDeleted ? (
                      <Button size="sm" variant="success" loading={restoring} onClick={() => restore(c)}>
                        <RotateCcw className="h-3 w-3" /> Restore
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => { resetRemove(); setRemoving(c); }}>
                        <Trash2 className="h-3 w-3" /> Remove
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
            data={content?.items ?? []}
            keyField="publicId"
            loading={contentLoading}
            dense
            emptyMessage="No content matches these filters."
          />

          {content && content.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-ink-muted">
                Page {content.pagination.page} of {content.pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={contentPage <= 1} onClick={() => setContentPage((p) => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={contentPage >= content.pagination.totalPages}
                  onClick={() => setContentPage((p) => p + 1)}
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'demo' && (
        <div className="space-y-4">
          <Select
            options={DEMO_STATUSES}
            value={demoStatus}
            onChange={(e) => { setDemoStatus(e.target.value); setDemoPage(1); }}
            className="sm:w-64"
          />

          <Table<AdminDemoRequest>
            columns={[
              {
                key: 'preferredSubject',
                header: 'Request',
                render: (d) => (
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{d.preferredSubject}</p>
                    <p className="truncate text-xs text-ink-muted">
                      {d.studentName} → {d.tutorName}
                    </p>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (d) => (
                  <div className="flex flex-col items-start gap-1">
                    <Badge variant={DEMO_VARIANT[d.status] ?? 'default'} tone="soft">{d.status}</Badge>
                    {d.rejectionReason && (
                      <span className="max-w-[200px] truncate text-[11px] text-ink-muted" title={d.rejectionReason}>
                        {d.rejectionReason}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                key: 'createdAt',
                header: 'Requested',
                render: (d) => (
                  <span className="whitespace-nowrap text-xs text-ink-muted">
                    {format(new Date(d.createdAt), 'MMM d, yyyy h:mm a')}
                  </span>
                ),
              },
            ]}
            data={demos?.items ?? []}
            keyField="publicId"
            loading={demosLoading}
            dense
            emptyMessage="No demo requests match this filter."
          />

          {demos && demos.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-ink-muted">
                Page {demos.pagination.page} of {demos.pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={demoPage <= 1} onClick={() => setDemoPage((p) => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={demoPage >= demos.pagination.totalPages}
                  onClick={() => setDemoPage((p) => p + 1)}
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'email' && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              index={0}
              title="Sent (7d)"
              value={(email?.total ?? 0).toLocaleString()}
              accent="brand"
              icon={<Mail className="h-5 w-5" />}
            />
            <StatsCard
              index={1}
              title="Handed off"
              value={(email?.accepted ?? 0).toLocaleString()}
              accent="green"
              icon={<Mail className="h-5 w-5" />}
            />
            <StatsCard
              index={2}
              title="Rejected"
              value={(email?.rejected ?? 0).toLocaleString()}
              accent="amber"
              icon={<AlertTriangle className="h-5 w-5" />}
            />
            <StatsCard
              index={3}
              title="Failure Rate"
              value={email ? `${email.failureRatePercent}%` : '—'}
              accent={email && email.failureRatePercent > 5 ? 'rose' : 'violet'}
              icon={<AlertTriangle className="h-5 w-5" />}
              hint={`${email?.failed ?? 0} outright failures`}
            />
          </div>

          {email?.note && (
            <div className="flex gap-2.5 rounded border border-rule bg-surface-sunk p-3.5">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-warn" />
              <p className="text-xs text-ink-2">{email.note}</p>
            </div>
          )}

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Recent Failures</CardTitle>
                <p className="mt-1 text-xs text-ink-muted">Messages the relay refused or that errored on send</p>
              </div>
            </CardHeader>
            <CardContent>
              {(email?.recentFailures ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-muted">
                  Nothing failed in the last {email?.periodDays ?? 7} days.
                </p>
              ) : (
                <div className="space-y-2">
                  {email!.recentFailures.map((f, i) => (
                    <div key={`${f.to}-${i}`} className="rounded border border-rule p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-ink">{f.subject}</p>
                        <Badge variant={f.status === 'FAILED' ? 'danger' : 'warning'} tone="soft">
                          {f.status}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-ink-muted">{f.to}</p>
                      {f.detail && (
                        <p className="mt-1.5 break-all font-mono text-[11px] text-danger">{f.detail}</p>
                      )}
                      <p className="mt-1 text-[11px] text-ink-faint">
                        {format(new Date(f.createdAt), 'MMM d, HH:mm')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={!!removing}
        title="Remove content"
        message={
          removing
            ? `"${removing.title}" by ${removing.tutorName} will be hidden from students and tutors. This is reversible — it stays listed under "Include removed" and can be restored.`
            : ''
        }
        confirmLabel="Remove"
        reasonLabel="Reason"
        loading={removingPending}
        error={removeError ? (removeError as Error).message : undefined}
        onCancel={() => setRemoving(null)}
        onConfirm={(reason) => removing && remove({ item: removing, reason })}
      />
    </div>
  );
}
