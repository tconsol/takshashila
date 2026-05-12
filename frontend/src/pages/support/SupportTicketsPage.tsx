import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { PageHeader } from '../../components/shared/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { Table } from '../../components/ui/Table';
import { api } from '../../lib/axios';

interface SupportTicket {
  publicId: string;
  subject: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  reporterPublicId: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
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
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['support', 'tickets', activeTab],
    queryFn: () => api.get(`/support/tickets?status=${activeTab}`).then((r) => r.data.data?.items ?? []),
    retry: false,
    placeholderData: [],
  });

  const { mutateAsync: updateStatus } = useMutation({
    mutationFn: ({ publicId, status }: { publicId: string; status: string }) =>
      api.patch(`/support/tickets/${publicId}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support', 'tickets'] });
      setSelected(null);
    },
  });

  const tickets: SupportTicket[] = (data as SupportTicket[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Support Tickets" subtitle="Manage and resolve support requests" />

      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

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
    </div>
  );
}

