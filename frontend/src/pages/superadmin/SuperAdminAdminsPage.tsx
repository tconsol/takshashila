import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { UserPlus } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { UserFormModal } from '../../components/shared/UserFormModal';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { adminUsersService, type DirectoryUser } from '../../services/admin-users.service';

type StatusVariant = 'success' | 'danger' | 'warning' | 'default';

const statusVariant: Record<string, StatusVariant> = {
  ACTIVE: 'success',
  SUSPENDED: 'danger',
  PENDING_VERIFICATION: 'warning',
  INACTIVE: 'default',
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
};

const CREATABLE_ROLES = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
];

export function SuperAdminAdminsPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  // The directory endpoint filters on a single role at a time — this page shows
  // both admin tiers, so two paginated calls are fetched and merged.
  const { data: admins = [], isLoading } = useQuery<DirectoryUser[]>({
    queryKey: ['superadmin', 'admins'],
    queryFn: async () => {
      const [admins, superAdmins] = await Promise.all([
        adminUsersService.list({ role: 'ADMIN', limit: 200 }),
        adminUsersService.list({ role: 'SUPER_ADMIN', limit: 200 }),
      ]);
      return [...superAdmins.items, ...admins.items];
    },
    retry: false,
  });

  const { mutateAsync: suspendUser, isPending: suspending } = useMutation({
    mutationFn: (publicId: string) => adminUsersService.suspend(publicId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['superadmin', 'admins'] }),
  });

  const { mutateAsync: activateUser, isPending: activating } = useMutation({
    mutationFn: (publicId: string) => adminUsersService.activate(publicId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['superadmin', 'admins'] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admins"
        subtitle="Manage platform administrators"
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4" /> Create admin
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : admins.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">No admins found</div>
      ) : (
        <div className="space-y-3">
          {admins.map((admin) => (
            <div key={admin.publicId} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-center gap-4">
              <Avatar name={`${admin.firstName} ${admin.lastName}`} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 dark:text-white">{admin.firstName} {admin.lastName}</p>
                  <Badge variant={admin.role === 'SUPER_ADMIN' ? 'default' : 'success'}>
                    {ROLE_LABEL[admin.role] ?? admin.role}
                  </Badge>
                  <Badge variant={statusVariant[admin.status] ?? 'default'}>
                    {admin.status.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{admin.email}</p>
                <div className="flex gap-4 mt-1 text-xs text-gray-400">
                  <span>Joined {format(new Date(admin.createdAt), 'MMM d, yyyy')}</span>
                  {admin.lastLoginAt && (
                    <span>Last login {format(new Date(admin.lastLoginAt), 'MMM d, yyyy')}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {admin.status === 'ACTIVE' ? (
                  <Button size="sm" variant="danger" onClick={() => suspendUser(admin.publicId)} loading={suspending}>
                    Suspend
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => activateUser(admin.publicId)} loading={activating}>
                    Activate
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <UserFormModal
        open={createOpen}
        mode="create"
        creatableRoles={CREATABLE_ROLES}
        onClose={() => setCreateOpen(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ['superadmin', 'admins'] })}
      />
    </div>
  );
}
