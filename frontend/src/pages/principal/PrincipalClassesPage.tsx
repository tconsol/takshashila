import { useState } from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { ClassCard } from '../../components/shared/ClassCard';
import { Tabs } from '../../components/ui/Tabs';
import { useMyClassesAsPrincipal } from '../../hooks/use-classes';

const EMPTY_LABELS: Record<string, string> = {
  SCHEDULED: 'No upcoming classes',
  LIVE: 'No classes currently in progress',
  COMPLETED: 'No completed classes',
  CANCELLED: 'No cancelled classes',
};

export function PrincipalClassesPage() {
  const [activeTab, setActiveTab] = useState('LIVE');

  const { data, isLoading } = useMyClassesAsPrincipal({ status: activeTab });
  const { data: liveData } = useMyClassesAsPrincipal({ status: 'LIVE', limit: '1' });
  const hasLive = (liveData?.total ?? 0) > 0;

  const classes = data?.items ?? [];

  const TABS = [
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
