import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { PageHeader } from '../../components/shared/PageHeader';
import { Table } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/axios';

interface AuditLog {
  publicId: string;
  actorId: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  ip?: string;
  createdAt: string;
}

interface AuditResponse {
  items: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type RoleVariant = 'info' | 'warning' | 'danger' | 'success' | 'default' | 'purple';

const roleVariant: Record<string, RoleVariant> = {
  SUPER_ADMIN: 'danger',
  ADMIN: 'warning',
  PRINCIPAL: 'info',
  TUTOR: 'success',
  STUDENT: 'default',
  SUPPORT: 'purple',
};

export function SuperAdminAuditPage() {
  const [actorId, setActorId] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (actorId.trim()) params.set('actorId', actorId.trim());

  const { data, isLoading } = useQuery<AuditResponse>({
    queryKey: ['audit', actorId, page],
    queryFn: () => api.get(`/audit?${params}`).then((r) => r.data.data),
  });

  const logs = data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Logs" subtitle="Track all administrative actions across the platform" />

      <div className="flex items-end gap-3">
        <div className="flex-1 max-w-xs">
          <Input
            label="Filter by Actor ID"
            placeholder="User public ID…"
            value={actorId}
            onChange={(e) => { setActorId(e.target.value); setPage(1); }}
          />
        </div>
        {actorId && (
          <Button variant="ghost" size="sm" onClick={() => setActorId('')}>Clear</Button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">Activity Log</h3>
          {data && <span className="text-sm text-gray-400">{data.total} entries</span>}
        </div>
        <div className="p-4">
          <Table
            columns={[
              {
                key: 'createdAt',
                header: 'Time',
                render: (l) => (
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {format(new Date(l.createdAt), 'MMM d, HH:mm:ss')}
                  </span>
                ),
              },
              {
                key: 'actorRole',
                header: 'Role',
                render: (l) => (
                  <Badge variant={roleVariant[l.actorRole] ?? 'default'} className="text-xs">
                    {l.actorRole}
                  </Badge>
                ),
              },
              {
                key: 'actorId',
                header: 'Actor',
                render: (l) => <span className="font-mono text-xs">{l.actorId.slice(0, 10)}…</span>,
              },
              {
                key: 'action',
                header: 'Action',
                render: (l) => <span className="font-medium text-sm">{l.action}</span>,
              },
              {
                key: 'resourceType',
                header: 'Resource',
                render: (l) => (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {l.resourceType}{l.resourceId ? ` · ${l.resourceId.slice(0, 8)}…` : ''}
                  </span>
                ),
              },
              {
                key: 'ip',
                header: 'IP',
                render: (l) => <span className="text-xs font-mono text-gray-400">{l.ip ?? '—'}</span>,
              },
            ]}
            data={logs}
            keyField="publicId"
            loading={isLoading}
            emptyMessage="No audit logs found"
          />
        </div>

        {data && data.totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-sm text-gray-500">Page {data.page} of {data.totalPages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <Button size="sm" variant="outline" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

