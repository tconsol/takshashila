import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Search, ChevronLeft, ChevronRight, ShieldCheck, ShieldAlert,
  Plus, Pencil, Trash2, RotateCcw, Download, Repeat,
} from 'lucide-react';
import { PageHeader } from './PageHeader';
import { UserDetailModal } from './UserDetailModal';
import { UserFormModal } from './UserFormModal';
import { ConfirmDialog } from './ConfirmDialog';
import { Modal } from '../ui/Modal';
import { Table, type TableColumn } from '../ui/Table';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Avatar } from '../ui/Avatar';
import { useAuthStore } from '../../stores/auth.store';
import { adminUsersService, type DirectoryUser } from '../../services/admin-users.service';

const PAGE_SIZE = 20;

export const ALL_ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'STUDENT', label: 'Students' },
  { value: 'TUTOR', label: 'Tutors' },
  { value: 'PRINCIPAL', label: 'Principals' },
  { value: 'PARENT', label: 'Parents' },
  { value: 'SUPPORT', label: 'Support' },
  { value: 'ADMIN', label: 'Admins' },
  { value: 'SUPER_ADMIN', label: 'Super Admins' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING_VERIFICATION', label: 'Pending verification' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

const DELETED_OPTIONS = [
  { value: 'exclude', label: 'Active records' },
  { value: 'include', label: 'Include deleted' },
  { value: 'only', label: 'Deleted only' },
];

type StatusVariant = 'success' | 'danger' | 'warning' | 'default';

const STATUS_VARIANT: Record<string, StatusVariant> = {
  ACTIVE: 'success',
  SUSPENDED: 'danger',
  PENDING_VERIFICATION: 'warning',
  INACTIVE: 'default',
};

const ROLE_COLORS: Record<string, string> = {
  STUDENT: 'bg-emerald-500',
  TUTOR: 'bg-sky-500',
  PRINCIPAL: 'bg-violet-500',
  SUPPORT: 'bg-amber-500',
  ADMIN: 'bg-rose-500',
  SUPER_ADMIN: 'bg-indigo-500',
  PARENT: 'bg-pink-500',
};

/** A row is a user account plus, when the listing is role-filtered, its profile. */
export interface DirectoryRow extends DirectoryUser {
  profile: Record<string, unknown> | null;
  isDeleted?: boolean;
}

interface PeopleDirectoryProps {
  title: string;
  eyebrow: string;
  description: string;
  icon: ReactNode;
  /** Locks the listing to one role and hides the role filter. */
  lockedRole?: string;
  /** Columns inserted between the name and status columns. */
  profileColumns?: TableColumn<DirectoryRow>[];
  /** Rendered above the table — stat cards, cohort panels, whatever fits. */
  summary?: ReactNode;
}

export function PeopleDirectory({
  title, eyebrow, description, icon, lockedRole, profileColumns = [], summary,
}: PeopleDirectoryProps) {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const [page, setPage] = useState(1);
  const [role, setRole] = useState(lockedRole ?? '');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [deleted, setDeleted] = useState<'exclude' | 'include' | 'only'>('exclude');

  const [viewing, setViewing] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<DirectoryRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'suspend' | 'activate' | 'delete' | null>(null);
  const [exporting, setExporting] = useState(false);
  const [changingRole, setChangingRole] = useState<DirectoryRow | null>(null);
  const [nextRole, setNextRole] = useState('');

  const query = useMemo(
    () => ({ page, limit: PAGE_SIZE, role, status, q: search, deleted }),
    [page, role, status, search, deleted],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['people-directory', query],
    queryFn: () => adminUsersService.list(query) as Promise<{
      items: DirectoryRow[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>,
    staleTime: 15_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['people-directory'] });
    qc.invalidateQueries({ queryKey: ['user-directory'] });
    qc.invalidateQueries({ queryKey: ['user-counts'] });
    qc.invalidateQueries({ queryKey: ['user-detail'] });
  };

  const { mutate: suspend, isPending: suspending } = useMutation({
    mutationFn: (publicId: string) => adminUsersService.suspend(publicId),
    onSuccess: invalidate,
  });
  const { mutate: activate, isPending: activating } = useMutation({
    mutationFn: (publicId: string) => adminUsersService.activate(publicId),
    onSuccess: invalidate,
  });
  const { mutate: restore, isPending: restoring } = useMutation({
    mutationFn: (publicId: string) => adminUsersService.restore(publicId),
    onSuccess: invalidate,
  });
  const {
    mutate: remove, isPending: removing, error: removeError, reset: resetRemove,
  } = useMutation({
    mutationFn: ({ publicId, reason }: { publicId: string; reason?: string }) =>
      adminUsersService.remove(publicId, reason),
    onSuccess: () => { invalidate(); setDeleting(null); },
  });

  const {
    mutate: changeRole, isPending: changingRolePending, error: roleError, reset: resetRole,
  } = useMutation({
    mutationFn: ({ publicId, role: newRole, reason }: { publicId: string; role: string; reason?: string }) =>
      adminUsersService.changeRole(publicId, newRole, reason),
    onSuccess: () => { invalidate(); setChangingRole(null); },
  });

  /**
   * Bulk actions run sequentially rather than with Promise.all so a single
   * rejection (a guard trip, say) doesn't hide the rest of the results — the
   * summary reports exactly how many succeeded.
   */
  const {
    mutate: runBulk, isPending: bulkRunning, error: bulkError, reset: resetBulk,
  } = useMutation({
    mutationFn: async ({ action, reason }: { action: 'suspend' | 'activate' | 'delete'; reason?: string }) => {
      const ids = [...selected];
      const failures: string[] = [];
      for (const id of ids) {
        try {
          if (action === 'suspend') await adminUsersService.suspend(id, reason);
          else if (action === 'activate') await adminUsersService.activate(id);
          else await adminUsersService.remove(id, reason);
        } catch (e) {
          failures.push((e as Error).message);
        }
      }
      if (failures.length > 0) {
        throw new Error(`${ids.length - failures.length} of ${ids.length} succeeded. First failure: ${failures[0]}`);
      }
    },
    onSuccess: () => { invalidate(); setSelected(new Set()); setBulkAction(null); },
  });

  const items = data?.items ?? [];
  const pagination = data?.pagination;

  const applyFilter = (fn: () => void) => { fn(); setPage(1); setSelected(new Set()); };

  const toggleRow = (publicId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(publicId)) next.delete(publicId);
      else next.add(publicId);
      return next;
    });
  };

  const allOnPageSelected = items.length > 0 && items.every((u) => selected.has(u.publicId));

  const toggleAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) items.forEach((u) => next.delete(u.publicId));
      else items.forEach((u) => next.add(u.publicId));
      return next;
    });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await adminUsersService.exportCsv(query);
    } finally {
      setExporting(false);
    }
  };

  const creatableRoles = useMemo(() => {
    const assignable = ALL_ROLE_OPTIONS.filter((o) => o.value);
    // Admins cannot mint accounts at or above their own level.
    return isSuperAdmin
      ? assignable
      : assignable.filter((o) => !['ADMIN', 'SUPER_ADMIN'].includes(o.value));
  }, [isSuperAdmin]);

  const columns: TableColumn<DirectoryRow>[] = [
    {
      key: 'select',
      header: '',
      width: '40px',
      render: (u) => (
        <input
          type="checkbox"
          checked={selected.has(u.publicId)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleRow(u.publicId)}
          aria-label={`Select ${u.firstName} ${u.lastName}`}
          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
      ),
    },
    {
      key: 'name',
      header: 'User',
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={`${u.firstName} ${u.lastName}`} src={u.avatarUrl} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900 dark:text-white">
              {u.firstName} {u.lastName}
              {u.isDeleted && <span className="ml-2 text-xs font-normal text-rose-500">deleted</span>}
            </p>
            <p className="truncate text-xs text-slate-400">{u.email}</p>
          </div>
        </div>
      ),
    },
    ...(lockedRole
      ? profileColumns
      : [{
          key: 'role',
          header: 'Role',
          render: (u: DirectoryRow) => (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              <span className={`h-2 w-2 rounded-full ${ROLE_COLORS[u.role] ?? 'bg-slate-400'}`} />
              {u.role.replace('_', ' ')}
            </span>
          ),
        }]),
    {
      key: 'status',
      header: 'Status',
      render: (u) => (
        <Badge variant={STATUS_VARIANT[u.status] ?? 'default'} tone="soft">
          {u.status.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Joined',
      render: (u) => (
        <span className="text-xs text-slate-500">{format(new Date(u.createdAt), 'MMM d, yyyy')}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (u) => (
        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {u.isDeleted ? (
            <Button size="sm" variant="success" loading={restoring} onClick={() => restore(u.publicId)}>
              <RotateCcw className="h-3 w-3" /> Restore
            </Button>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(u.publicId); setFormMode('edit'); }}>
                <Pencil className="h-3 w-3" /> Edit
              </Button>
              {isSuperAdmin && (
                <Button
                  size="sm"
                  variant="ghost"
                  title="Change role"
                  onClick={() => { resetRole(); setNextRole(''); setChangingRole(u); }}
                >
                  <Repeat className="h-3 w-3" />
                </Button>
              )}
              {u.status === 'SUSPENDED' ? (
                <Button size="sm" variant="success" loading={activating} onClick={() => activate(u.publicId)}>
                  <ShieldCheck className="h-3 w-3" /> Activate
                </Button>
              ) : (
                <Button size="sm" variant="outline" loading={suspending} onClick={() => suspend(u.publicId)}>
                  <ShieldAlert className="h-3 w-3" /> Suspend
                </Button>
              )}
              <Button
                size="sm"
                variant="danger"
                onClick={() => { resetRemove(); setDeleting(u); }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        eyebrow={eyebrow}
        description={description}
        icon={icon}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" loading={exporting} onClick={handleExport}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button onClick={() => { setEditing(null); setFormMode('create'); }}>
              <Plus className="h-4 w-4" /> New {lockedRole ? lockedRole.toLowerCase() : 'user'}
            </Button>
          </div>
        }
      />

      {summary}

      <div className={`grid gap-3 sm:grid-cols-2 ${lockedRole ? 'lg:grid-cols-[2fr_1fr_1fr]' : 'lg:grid-cols-[2fr_1fr_1fr_1fr]'}`}>
        <Input
          placeholder="Search name, email or student ID…"
          leftIcon={<Search className="h-4 w-4" />}
          value={search}
          onChange={(e) => applyFilter(() => setSearch(e.target.value))}
        />
        {!lockedRole && (
          <Select
            options={ALL_ROLE_OPTIONS}
            value={role}
            onChange={(e) => applyFilter(() => setRole(e.target.value))}
            placeholder="All roles"
          />
        )}
        <Select
          options={STATUS_OPTIONS}
          value={status}
          onChange={(e) => applyFilter(() => setStatus(e.target.value))}
          placeholder="All statuses"
        />
        <Select
          options={DELETED_OPTIONS}
          value={deleted}
          onChange={(e) => applyFilter(() => setDeleted(e.target.value as typeof deleted))}
        />
      </div>

      {search.length === 1 && (
        <p className="-mt-3 text-xs text-slate-400">Type at least 2 characters to search.</p>
      )}

      {/* Bulk action bar — only present once something is selected */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-900/60 dark:bg-indigo-900/20">
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-indigo-900 dark:text-indigo-200">
              <input
                type="checkbox"
                checked={allOnPageSelected}
                onChange={toggleAllOnPage}
                className="h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
              />
              {selected.size} selected
            </label>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => { resetBulk(); setBulkAction('activate'); }}>
              <ShieldCheck className="h-3 w-3" /> Activate
            </Button>
            <Button size="sm" variant="outline" onClick={() => { resetBulk(); setBulkAction('suspend'); }}>
              <ShieldAlert className="h-3 w-3" /> Suspend
            </Button>
            <Button size="sm" variant="danger" onClick={() => { resetBulk(); setBulkAction('delete'); }}>
              <Trash2 className="h-3 w-3" /> Delete
            </Button>
          </div>
        </div>
      )}

      {selected.size === 0 && items.length > 0 && (
        <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={false}
            onChange={toggleAllOnPage}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          Select all {items.length} on this page
        </label>
      )}

      <Table<DirectoryRow>
        columns={columns}
        data={items}
        keyField="publicId"
        loading={isLoading}
        onRowClick={(u) => setViewing(u.publicId)}
        emptyMessage="No records match these filters."
      />

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total.toLocaleString()} records
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <UserDetailModal
        publicId={viewing}
        onClose={() => setViewing(null)}
        onSuspend={(id) => suspend(id)}
        onActivate={(id) => activate(id)}
        mutating={suspending || activating}
      />

      <UserFormModal
        open={formMode !== null}
        mode={formMode ?? 'create'}
        publicId={editing}
        lockedRole={formMode === 'create' ? lockedRole : undefined}
        creatableRoles={creatableRoles}
        onClose={() => { setFormMode(null); setEditing(null); }}
      />

      {/* Role change — super admin only */}
      <Modal
        open={!!changingRole}
        onClose={() => setChangingRole(null)}
        title="Change role"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setChangingRole(null)}>Cancel</Button>
            <Button
              loading={changingRolePending}
              disabled={!nextRole || nextRole === changingRole?.role}
              onClick={() =>
                changingRole && changeRole({ publicId: changingRole.publicId, role: nextRole })
              }
            >
              Change role
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {changingRole?.firstName} {changingRole?.lastName} is currently a{' '}
            <strong>{changingRole?.role.replace('_', ' ')}</strong>. Changing this rewrites what
            they can see and do. Their old role profile is kept so past classes and ledger entries
            still resolve, and the new role&apos;s profile is created if they have never held it.
          </p>
          <Select
            label="New role"
            options={ALL_ROLE_OPTIONS.filter((o) => o.value && o.value !== changingRole?.role)}
            value={nextRole}
            onChange={(e) => setNextRole(e.target.value)}
            placeholder="Pick a role"
          />
          {roleError && <p className="text-sm font-medium text-rose-500">{(roleError as Error).message}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={bulkAction !== null}
        title={
          bulkAction === 'delete' ? `Delete ${selected.size} users`
            : bulkAction === 'suspend' ? `Suspend ${selected.size} users`
              : `Activate ${selected.size} users`
        }
        message={
          bulkAction === 'delete'
            ? `${selected.size} accounts will be removed from every listing and blocked from signing in. Records are kept and can be restored from the "Deleted only" filter. Accounts you are not allowed to act on will be skipped and reported.`
            : bulkAction === 'suspend'
              ? `${selected.size} accounts will be blocked from signing in until reactivated.`
              : `${selected.size} accounts will be returned to active status.`
        }
        confirmLabel={bulkAction === 'delete' ? 'Delete all' : bulkAction === 'suspend' ? 'Suspend all' : 'Activate all'}
        confirmPhrase={bulkAction === 'delete' ? 'DELETE' : undefined}
        reasonLabel={bulkAction === 'activate' ? undefined : 'Reason'}
        loading={bulkRunning}
        error={bulkError ? (bulkError as Error).message : undefined}
        onCancel={() => setBulkAction(null)}
        onConfirm={(reason) => bulkAction && runBulk({ action: bulkAction, reason })}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Delete user"
        message={
          deleting
            ? `${deleting.firstName} ${deleting.lastName} will be removed from every listing and blocked from signing in. The record is kept so classes, ledger entries and audit history still resolve — you can restore the account later from the "Deleted only" filter.`
            : ''
        }
        confirmLabel="Delete user"
        confirmPhrase="DELETE"
        reasonLabel="Reason"
        loading={removing}
        error={removeError ? (removeError as Error).message : undefined}
        onCancel={() => setDeleting(null)}
        onConfirm={(reason) => deleting && remove({ publicId: deleting.publicId, reason })}
      />
    </div>
  );
}
