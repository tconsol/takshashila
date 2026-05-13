import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Users } from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '../../components/shared/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/shared/EmptyState';
import { Spinner } from '../../components/ui/Loading';
import { useParentChildren, useChildWorksheets } from '../../hooks/use-parent';
import { cn } from '../../lib/utils';

export function ParentWorksheetsPage() {
  const { data: children = [], isLoading: childrenLoading } = useParentChildren();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId && children.length > 0) setSelectedId(children[0].publicId);
  }, [children, selectedId]);

  const { data, isLoading: wsLoading } = useChildWorksheets(selectedId ?? '', { limit: '50' });
  const items = data?.items ?? [];
  const selectedChild = children.find((c) => c.publicId === selectedId);

  if (childrenLoading) return <div className="flex justify-center py-20"><Spinner /></div>;

  if (children.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-8 w-8" />}
        title="No children linked"
        description="Add your child's Student ID to view their worksheets."
        action={<Link to="/dashboard/parent/children"><Button variant="gradient"><Users className="h-4 w-4 mr-1.5" /> My Children</Button></Link>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Worksheets"
        subtitle={selectedChild ? `${selectedChild.firstName} ${selectedChild.lastName}`.trim() : 'Loading…'}
        icon={<FileText className="h-5 w-5" />}
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

      {wsLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">No worksheets available</div>
      ) : (
        <div className="space-y-3">
          {items.map((w) => (
            <div key={w.publicId} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 dark:text-white">{w.title}</p>
                    {w.subject && <Badge variant="info">{w.subject}</Badge>}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{w.description}</p>
                  <p className="text-xs text-gray-400 mt-1">Added {format(new Date(w.createdAt), 'MMM d, yyyy')}</p>
                </div>
              </div>
              {w.content && (
                <div className="mt-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 line-clamp-3 whitespace-pre-wrap">
                  {w.content}
                </div>
              )}
              {w.fileUrl && (
                <a
                  href={w.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
                >
                  <FileText className="h-3 w-3" /> Download worksheet
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
