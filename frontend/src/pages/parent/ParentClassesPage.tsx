import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Video, Users } from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '../../components/shared/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/shared/EmptyState';
import { Spinner } from '../../components/ui/Loading';
import { useParentChildren, useChildClasses } from '../../hooks/use-parent';
import { cn } from '../../lib/utils';

const statusBadge: Record<string, 'info' | 'warning' | 'success' | 'danger' | 'default'> = {
  SCHEDULED: 'info', IN_PROGRESS: 'warning', COMPLETED: 'success', CANCELLED: 'danger',
};

export function ParentClassesPage() {
  const { data: children = [], isLoading: childrenLoading } = useParentChildren();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId && children.length > 0) setSelectedId(children[0].publicId);
  }, [children, selectedId]);

  const { data, isLoading: classesLoading } = useChildClasses(selectedId ?? '', { limit: '50' });
  const selectedChild = children.find((c) => c.publicId === selectedId);

  if (childrenLoading) return <div className="flex justify-center py-20"><Spinner /></div>;

  if (children.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-8 w-8" />}
        title="No children linked"
        description="Add your child's Student ID to start monitoring their classes."
        action={<Link to="/dashboard/parent/children"><Button variant="gradient"><Users className="h-4 w-4 mr-1.5" /> My Children</Button></Link>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes"
        subtitle={selectedChild ? `${selectedChild.firstName} ${selectedChild.lastName}`.trim() : 'Loading…'}
        icon={<Video className="h-5 w-5" />}
      />

      {/* Child selector */}
      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {children.map((child) => {
            const name = `${child.firstName} ${child.lastName}`.trim();
            return (
              <button
                key={child.publicId}
                onClick={() => setSelectedId(child.publicId)}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                  selectedId === child.publicId
                    ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-600 dark:bg-brand-900/20 dark:text-brand-300'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
                )}
              >
                <Avatar name={name} size="xs" />
                {name}
              </button>
            );
          })}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">All Classes</h3>
        </div>
        <div className="p-4">
          <Table
            columns={[
              {
                key: 'title',
                header: 'Class',
                render: (c) => <span className="font-medium text-gray-800 dark:text-gray-200">{c.title}</span>,
              },
              {
                key: 'classType',
                header: 'Type',
                render: (c) => <Badge variant="info">{c.classType}</Badge>,
              },
              {
                key: 'status',
                header: 'Status',
                render: (c) => <Badge variant={statusBadge[c.status] ?? 'default'}>{c.status}</Badge>,
              },
              {
                key: 'startUTC',
                header: 'Date',
                render: (c) => c.startUTC ? format(new Date(c.startUTC), 'EEE, MMM d yyyy · h:mm a') : '—',
              },
            ]}
            data={data?.items ?? []}
            keyField="publicId"
            loading={classesLoading}
            emptyMessage="No classes found"
          />
        </div>
      </div>
    </div>
  );
}
