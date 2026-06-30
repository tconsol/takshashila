import { useState } from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { ClassCard } from '../../components/shared/ClassCard';
import { Tabs } from '../../components/ui/Tabs';
import { Table } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { useMyClassesAsPrincipal } from '../../hooks/use-classes';

const EMPTY_LABELS: Record<string, string> = {
  ALL: 'No classes yet',
  SCHEDULED: 'No upcoming classes',
  LIVE: 'No classes currently in progress',
  COMPLETED: 'No completed classes',
  CANCELLED: 'No cancelled classes',
};

const STATUS_VARIANT: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  COMPLETED: 'success',
  CANCELLED: 'danger',
  LIVE: 'warning',
  SCHEDULED: 'info',
};

export function PrincipalClassesPage() {
  const [activeTab, setActiveTab] = useState('ALL');

  const { data, isLoading } = useMyClassesAsPrincipal(activeTab === 'ALL' ? { limit: '100' } : { status: activeTab });
  const { data: liveData } = useMyClassesAsPrincipal({ status: 'LIVE', limit: '1' });
  const hasLive = (liveData?.total ?? 0) > 0;

  const classes = (data?.items ?? []).slice().sort(
    (a, b) => new Date(b.scheduledStartUTC).getTime() - new Date(a.scheduledStartUTC).getTime(),
  ); // newest → oldest

  const TABS = [
    { key: 'ALL', label: 'All' },
    { key: 'LIVE', label: 'In Progress', indicator: hasLive },
    { key: 'SCHEDULED', label: 'Upcoming' },
    { key: 'COMPLETED', label: 'Completed' },
    { key: 'CANCELLED', label: 'Cancelled' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes"
        subtitle="Monitor all classes under your tutors"
      />

      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          {EMPTY_LABELS[activeTab] ?? 'No classes found'}
        </div>
      ) : activeTab === 'ALL' ? (
        /* ── ALL: table view (newest → oldest) ── */
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <Table
            keyField="publicId"
            data={classes}
            columns={[
              {
                key: 'subject',
                header: 'Class',
                render: (c) => <span className="font-medium text-gray-900 dark:text-white">{c.subject || 'Class'}</span>,
              },
              {
                key: 'classType',
                header: 'Type',
                render: (c) => <Badge variant="purple">{c.classType.replace(/_/g, ' ')}</Badge>,
              },
              {
                key: 'scheduledStartUTC',
                header: 'Date & Time',
                render: (c) => (
                  <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {new Date(c.scheduledStartUTC).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (c) => <Badge variant={STATUS_VARIANT[c.status] ?? 'default'}>{c.status}</Badge>,
              },
            ]}
            emptyMessage="No classes yet"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {classes.map((cls) => (
            <ClassCard key={cls.publicId} cls={cls} perspective="principal" />
          ))}
        </div>
      )}
    </div>
  );
}
