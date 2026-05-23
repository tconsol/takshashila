import { useState } from 'react';
import { format } from 'date-fns';
import { PageHeader } from '../../components/shared/PageHeader';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { usePrincipalList, usePendingPrincipals, useApprovePrincipal, useSuspendPrincipal } from '../../hooks/use-principals';
import type { PrincipalProfile } from '../../services/principals.service';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const statusVariant: Record<string, BadgeVariant> = {
  ACTIVE: 'success',
  PENDING_APPROVAL: 'warning',
  SUSPENDED: 'danger',
  INACTIVE: 'default',
};

const TABS = [
  { key: 'all', label: 'All Principals' },
  { key: 'pending', label: 'Pending Approval' },
];

export function AdminPrincipalsPage() {
  const [activeTab, setActiveTab] = useState('all');
  const { data: pendingData, isLoading: pendingLoading } = usePendingPrincipals();
  const { data: allData, isLoading: allLoading } = usePrincipalList();
  const { mutateAsync: approve, isPending: approving } = useApprovePrincipal();
  const { mutateAsync: suspend, isPending: suspending } = useSuspendPrincipal();

  const displayList = activeTab === 'pending'
    ? (pendingData?.items ?? [])
    : (allData?.items ?? []);
  const isLoading = activeTab === 'pending' ? pendingLoading : allLoading;

  return (
    <div className="space-y-6">
      <PageHeader title="Principals" subtitle="Review and manage principal accounts" />

      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : displayList.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          {activeTab === 'pending' ? 'No principals pending approval' : 'No principals found'}
        </div>
      ) : (
        <div className="space-y-3">
          {displayList.map((principal) => (
            <PrincipalRow
              key={principal.publicId}
              principal={principal}
              statusVariant={statusVariant}
              onApprove={principal.status !== 'ACTIVE' ? () => approve(principal.publicId) : undefined}
              onSuspend={principal.status === 'ACTIVE' ? () => suspend(principal.publicId) : undefined}
              approving={approving}
              suspending={suspending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PrincipalRow({
  principal,
  statusVariant,
  onApprove,
  onSuspend,
  approving,
  suspending,
}: {
  principal: PrincipalProfile;
  statusVariant: Record<string, BadgeVariant>;
  onApprove?: () => void;
  onSuspend?: () => void;
  approving: boolean;
  suspending: boolean;
}) {
  const fullName = `${principal.firstName} ${principal.lastName}`.trim() || 'Unknown';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-center gap-4">
      <Avatar name={fullName} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-gray-900 dark:text-white">{fullName}</p>
          <Badge variant={statusVariant[principal.status] ?? 'default'}>
            {principal.status.replace('_', ' ')}
          </Badge>
        </div>
        <div className="flex gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
          {principal.email && <span>{principal.email}</span>}
          {principal.organizationName && <span>{principal.organizationName}</span>}
          <span>{principal.totalTutors} tutors</span>
          <span>{principal.totalStudents} students</span>
          <span>Joined {format(new Date(principal.createdAt), 'MMM d, yyyy')}</span>
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        {onApprove && (
          <Button size="sm" onClick={onApprove} loading={approving}>Approve</Button>
        )}
        {onSuspend && (
          <Button size="sm" variant="danger" onClick={onSuspend} loading={suspending}>Suspend</Button>
        )}
      </div>
    </div>
  );
}
