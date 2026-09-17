import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { Table } from '../../components/ui/Table';
import { Select } from '../../components/ui/Select';
import { api } from '../../lib/axios';
import { useTabActivity } from '../../hooks/use-tab-activity';

interface SupportTicket {
  publicId: string;
  subject: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  reporterPublicId: string;
  assignedTo?: string;
  /** Resolved server-side so the queue is workable without extra lookups. */
  requesterName?: string;
  requesterEmail?: string;
  requesterRole?: string;
  assigneePublicId?: string;
  assigneeName?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Agent {
  publicId: string;
  name: string;
  role: string;
}

type StatusVariant = 'info' | 'warning' | 'success' | 'default';
type PriorityVariant = 'default' | 'warning' | 'danger' | 'info';

const statusVariant: Record<string, StatusVariant> = {
  OPEN: 'info',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  CLOSED: 'default',
};

const priorityVariant: Record<string, PriorityVariant> = {
  LOW: 'default',
  MEDIUM: 'info',
  HIGH: 'warning',
  URGENT: 'danger',
};

const TABS = [
  { key: 'OPEN', label: 'Open' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'CLOSED', label: 'Closed' },
];

export function SupportTicketsPage() {
  const [activeTab, setActiveTab] = useState('OPEN');
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupportTicket | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['support', 'tickets', activeTab],
    queryFn: () => api.get(`/support/tickets?status=${activeTab}`).then((r) => r.data.data?.items ?? []),
    retry: false,
    placeholderData: [],
  });

  // Lightweight counts per status (independent of the active tab) so a status
  // change — e.g. a ticket moving into Resolved — lights up that tab even
  // while viewing a different one.
  const { data: statusCounts } = useQuery({
    queryKey: ['support', 'tickets', 'counts'],
    queryFn: async () => {
      const entries = await Promise.all(
        TABS.map(async ({ key }) => {
          const r = await api.get(`/support/tickets?status=${key}&limit=1`);
          return [key, r.data.data?.pagination?.total ?? 0] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, number>;
    },
    retry: false,
  });
  const { dirty, markSeen } = useTabActivity(statusCounts ?? {}, activeTab);

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['support', 'agents'],
    queryFn: () => api.get('/support/agents').then((r) => r.data.data ?? []),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const { mutate: assign, isPending: assigning } = useMutation({
    mutationFn: ({ publicId, assigneePublicId }: { publicId: string; assigneePublicId: string }) =>
      api.patch(`/support/tickets/${publicId}`, { assigneePublicId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'tickets'] }),
  });

  const { mutateAsync: updateStatus } = useMutation({
    mutationFn: ({ publicId, status }: { publicId: string; status: string }) =>
      api.patch(`/support/tickets/${publicId}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support', 'tickets'] });
      setSelected(null);
    },
  });

  const {
    mutate: deleteTicket, isPending: deleting, error: deleteError, reset: resetDelete,
  } = useMutation({
    mutationFn: (publicId: string) => api.delete(`/support/tickets/${publicId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support', 'tickets'] });
      setDeleteTarget(null);
      setSelected(null);
    },
  });

  const tickets: SupportTicket[] = (data as SupportTicket[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Support Tickets" subtitle="Manage and resolve support requests" />

      <Tabs
        tabs={TABS.map((t) => ({ ...t, indicator: dirty.has(t.key) }))}
        activeTab={activeTab}
        onChange={(key) => { setActiveTab(key); markSeen(key); }}
      />

      <Table
        columns={[
          {
            key: 'subject',
            header: 'Subject',
            render: (t) => (
              <button
                className="text-left font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                onClick={() => setSelected(t)}
              >
                {t.subject}
              </button>
            ),
          },
          {
            key: 'requesterName',
            header: 'Raised by',
            render: (t) => (
              <div className="min-w-0">
                <p className="truncate text-sm text-ink-2">{t.requesterName ?? '—'}</p>
                {t.requesterRole && <p className="truncate text-xs text-ink-muted">{t.requesterRole}</p>}
              </div>
            ),
          },
          {
            key: 'assigneeName',
            header: 'Assigned to',
            render: (t) => (
              <Select
                options={[
                  { value: '', label: 'Unassigned' },
                  ...agents.map((a) => ({ value: a.publicId, label: `${a.name} (${a.role})` })),
                ]}
                value={t.assigneePublicId ?? ''}
                disabled={assigning}
                onChange={(e) => assign({ publicId: t.publicId, assigneePublicId: e.target.value })}
                className="w-48"
              />
            ),
          },
          {
            key: 'priority',
            header: 'Priority',
            render: (t) => (
              <Badge variant={priorityVariant[t.priority] ?? 'default'}>{t.priority}</Badge>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (t) => (
              <Badge variant={statusVariant[t.status] ?? 'default'}>{t.status.replace('_', ' ')}</Badge>
            ),
          },
          {
            key: 'createdAt',
            header: 'Created',
            render: (t) => format(new Date(t.createdAt), 'MMM d, h:mm a'),
          },
          {
            key: 'actions',
            header: '',
            render: (t) => (
              <button
                onClick={() => setSelected(t)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                View
              </button>
            ),
          },
        ]}
        data={tickets}
        keyField="publicId"
        loading={isLoading}
        emptyMessage={`No ${activeTab.toLowerCase().replace('_', ' ')} tickets`}
        onRowClick={setSelected}
      />

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.subject ?? ''}
        size="md"
        footer={
          <div className="flex gap-2">
            {selected?.status === 'OPEN' && (
              <Button size="sm" onClick={() => updateStatus({ publicId: selected.publicId, status: 'IN_PROGRESS' })}>
                Start Working
              </Button>
            )}
            {selected?.status === 'IN_PROGRESS' && (
              <Button size="sm" variant="secondary" onClick={() => updateStatus({ publicId: selected.publicId, status: 'RESOLVED' })}>
                Mark Resolved
              </Button>
            )}
            {(selected?.status === 'RESOLVED' || selected?.status === 'IN_PROGRESS') && (
              <Button size="sm" variant="ghost" onClick={() => updateStatus({ publicId: selected.publicId, status: 'CLOSED' })}>
                Close
              </Button>
            )}
            {selected && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => { resetDelete(); setDeleteTarget(selected); }}
              >
                <Trash2 className="h-3 w-3" /> Delete
              </Button>
            )}
          </div>
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Badge variant={statusVariant[selected.status] ?? 'default'}>{selected.status}</Badge>
              <Badge variant={priorityVariant[selected.priority] ?? 'default'}>{selected.priority}</Badge>
            </div>
            <div className="text-xs text-gray-400">
              Reported {format(new Date(selected.createdAt), 'MMM d, yyyy h:mm a')} · ID: {selected.publicId.slice(0, 8)}
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {selected.description}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete ticket"
        message={
          deleteTarget
            ? `"${deleteTarget.subject}" and its message thread will be removed. Prefer closing a ticket over deleting it — closing keeps the history.`
            : ''
        }
        confirmLabel="Delete ticket"
        confirmPhrase="DELETE"
        loading={deleting}
        error={deleteError ? (deleteError as Error).message : undefined}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteTicket(deleteTarget.publicId)}
      />
    </div>
  );
}

