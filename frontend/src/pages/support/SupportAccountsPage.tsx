import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { PageHeader } from '../../components/shared/PageHeader';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { api } from '../../lib/axios';

interface UserAccount {
  publicId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  emailVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

type StatusVariant = 'success' | 'danger' | 'warning' | 'default';
type RoleVariant = 'info' | 'warning' | 'success' | 'default' | 'purple' | 'danger';

const statusVariant: Record<string, StatusVariant> = {
  ACTIVE: 'success',
  SUSPENDED: 'danger',
  PENDING_VERIFICATION: 'warning',
  INACTIVE: 'default',
};

const roleVariant: Record<string, RoleVariant> = {
  SUPER_ADMIN: 'danger',
  ADMIN: 'warning',
  PRINCIPAL: 'info',
  TUTOR: 'success',
  STUDENT: 'default',
  SUPPORT: 'purple',
};

export function SupportAccountsPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState<UserAccount | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['support', 'accounts', debouncedSearch],
    queryFn: () => api.get(`/users?search=${debouncedSearch}&limit=20`).then((r) => r.data.data?.items ?? []),
    retry: false,
    placeholderData: [],
  });

  const accounts: UserAccount[] = (data as UserAccount[]) ?? [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(search);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Account Lookup" subtitle="Search and review user accounts" />

      <form onSubmit={handleSearch} className="flex gap-3">
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        <Button type="submit">Search</Button>
      </form>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          {debouncedSearch ? 'No accounts found' : 'Enter a name or email to search'}
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => (
            <div
              key={account.publicId}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              onClick={() => setSelected(account)}
            >
              <Avatar name={`${account.firstName} ${account.lastName}`} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {account.firstName} {account.lastName}
                  </p>
                  <Badge variant={roleVariant[account.role] ?? 'default'} className="text-xs">{account.role}</Badge>
                  <Badge variant={statusVariant[account.status] ?? 'default'} className="text-xs">
                    {account.status.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{account.email}</p>
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">
                {format(new Date(account.createdAt), 'MMM d, yyyy')}
              </span>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Account Details"
        size="md"
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={`${selected.firstName} ${selected.lastName}`} size="lg" />
              <div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selected.firstName} {selected.lastName}
                </p>
                <p className="text-sm text-gray-500">{selected.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-400 text-xs mb-1">Role</p>
                <Badge variant={roleVariant[selected.role] ?? 'default'}>{selected.role}</Badge>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-1">Status</p>
                <Badge variant={statusVariant[selected.status] ?? 'default'}>{selected.status.replace('_', ' ')}</Badge>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-1">Email Verified</p>
                <p className="font-medium text-gray-700 dark:text-gray-300">
                  {selected.emailVerified ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-1">Last Login</p>
                <p className="font-medium text-gray-700 dark:text-gray-300">
                  {selected.lastLoginAt ? format(new Date(selected.lastLoginAt), 'MMM d, yyyy') : 'Never'}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-1">Account ID</p>
                <p className="font-mono text-xs text-gray-500">{selected.publicId}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-1">Joined</p>
                <p className="font-medium text-gray-700 dark:text-gray-300">
                  {format(new Date(selected.createdAt), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

