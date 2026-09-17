import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Download, Search, ScrollText, X } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Table } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/axios';
import { downloadCsv } from '../../lib/download';

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

// sendPaginated nests the counters under `pagination` — a flat shape here silently
// disabled the pager and blanked the entry count.
interface AuditResponse {
  items: AuditLog[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface AuditFacets {
  actions: string[];
  resourceTypes: string[];
  actorRoles: string[];
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
  const [filters, setFilters] = useState({
    q: '', actorId: '', actorRole: '', action: '', resourceType: '', from: '', to: '',
  });
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const set = (key: keyof typeof filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const activeFilters = useMemo(
    () => Object.entries(filters).filter(([, v]) => v.trim() !== ''),
    [filters],
  );

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    for (const [key, value] of activeFilters) params.set(key, value.trim());
    return params.toString();
  }, [page, activeFilters]);

  const { data, isLoading } = useQuery<AuditResponse>({
    queryKey: ['audit', queryString],
    queryFn: () => api.get(`/audit?${queryString}`).then((r) => r.data.data),
  });

  const { data: facets } = useQuery<AuditFacets>({
    queryKey: ['audit-facets'],
    queryFn: () => api.get('/audit/facets').then((r) => r.data.data),
    staleTime: 5 * 60_000,
  });

  const toOptions = (values: string[] | undefined, allLabel: string) => [
    { value: '', label: allLabel },
    ...(values ?? []).map((v) => ({ value: v, label: v.replace(/_/g, ' ') })),
  ];

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ max: '5000' });
      for (const [key, value] of activeFilters) params.set(key, value.trim());
      await downloadCsv(`/audit/export?${params.toString()}`, `audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        eyebrow="Governance"
        description="Every privileged action on the platform, filterable and exportable."
        icon={<ScrollText className="h-5 w-5" />}
        actions={
          <Button variant="outline" loading={exporting} onClick={handleExport}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Input
          placeholder="Search action, resource or ID…"
          leftIcon={<Search className="h-4 w-4" />}
          value={filters.q}
          onChange={(e) => set('q', e.target.value)}
        />
        <Select
          options={toOptions(facets?.actions, 'All actions')}
          value={filters.action}
          onChange={(e) => set('action', e.target.value)}
          placeholder="All actions"
        />
        <Select
          options={toOptions(facets?.resourceTypes, 'All resources')}
          value={filters.resourceType}
          onChange={(e) => set('resourceType', e.target.value)}
          placeholder="All resources"
        />
        <Select
          options={toOptions(facets?.actorRoles, 'All roles')}
          value={filters.actorRole}
          onChange={(e) => set('actorRole', e.target.value)}
          placeholder="All roles"
        />
        <Input type="date" label="From" value={filters.from} onChange={(e) => set('from', e.target.value)} />
        <Input type="date" label="To" value={filters.to} onChange={(e) => set('to', e.target.value)} />
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map(([key, value]) => (
            <button
              key={key}
              onClick={() => set(key as keyof typeof filters, '')}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            >
              {key}: {value}
              <X className="h-3 w-3" />
            </button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setFilters({ q: '', actorId: '', actorRole: '', action: '', resourceType: '', from: '', to: '' });
              setPage(1);
            }}
          >
            Clear all
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Activity Log</h3>
          {data && (
            <span className="text-sm text-gray-400">
              {data.pagination.total.toLocaleString()} entries
            </span>
          )}
        </div>
        <div className="p-4">
          <Table<AuditLog>
            columns={[
              {
                key: 'createdAt',
                header: 'Time',
                render: (l) => (
                  <span className="whitespace-nowrap text-xs text-gray-500">
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
                render: (l) => (
                  <button
                    onClick={() => set('actorId', l.actorId)}
                    className="font-mono text-xs text-brand-600 hover:underline"
                    title="Filter by this actor"
                  >
                    {l.actorId.slice(0, 10)}…
                  </button>
                ),
              },
              {
                key: 'action',
                header: 'Action',
                render: (l) => <span className="text-sm font-medium">{l.action}</span>,
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
                render: (l) => <span className="font-mono text-xs text-gray-400">{l.ip ?? ''}</span>,
              },
            ]}
            data={data?.items ?? []}
            keyField="publicId"
            loading={isLoading}
            dense
            emptyMessage="No audit logs match these filters."
          />
        </div>

        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3 dark:border-gray-700">
            <span className="text-sm text-gray-500">
              Page {data.pagination.page} of {data.pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
