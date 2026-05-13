import { useState } from 'react';
import { format } from 'date-fns';
import { FileText, Search, Eye } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Loading';
import { EmptyState } from '../../components/shared/EmptyState';
import { useMyWorksheetsAsStudent } from '../../hooks/use-worksheets';
import type { Worksheet } from '../../services/worksheets.service';

export function StudentWorksheetsPage() {
  const [search, setSearch] = useState('');
  const [viewWorksheet, setViewWorksheet] = useState<Worksheet | null>(null);

  const { data, isLoading } = useMyWorksheetsAsStudent({ limit: '50' });
  const allItems = data?.items ?? [];

  const filtered = allItems.filter((w) =>
    w.title.toLowerCase().includes(search.toLowerCase()) ||
    (w.subject ?? '').toLowerCase().includes(search.toLowerCase()) ||
    w.description.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Worksheets"
        subtitle={`${allItems.length} worksheet${allItems.length !== 1 ? 's' : ''} available`}
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title or subject…"
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title={search ? 'No matching worksheets' : 'No worksheets yet'}
          description={search ? 'Try a different search term.' : 'Your tutor will share worksheets here as your learning progresses.'}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((w) => (
            <div
              key={w.publicId}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setViewWorksheet(w)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex flex-col items-end gap-1">
                  {w.subject && <Badge variant="info">{w.subject}</Badge>}
                  {w.fileUrl && (
                    <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">+ File</span>
                  )}
                </div>
              </div>

              <div>
                <p className="font-semibold text-gray-900 dark:text-white leading-snug">{w.title}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-3">{w.description}</p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700 mt-auto">
                <span className="text-xs text-gray-400">{format(new Date(w.createdAt), 'MMM d, yyyy')}</span>
                <button
                  onClick={() => setViewWorksheet(w)}
                  className="flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
                >
                  <Eye className="h-3.5 w-3.5" /> View
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Worksheet Modal */}
      <Modal
        open={!!viewWorksheet}
        onClose={() => setViewWorksheet(null)}
        title={viewWorksheet?.title ?? ''}
        size="xl"
      >
        {viewWorksheet && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap items-center">
              {viewWorksheet.subject && <Badge variant="info">{viewWorksheet.subject}</Badge>}
              <span className="text-xs text-gray-400">
                Added {format(new Date(viewWorksheet.createdAt), 'MMM d, yyyy')}
              </span>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{viewWorksheet.description}</p>

            {viewWorksheet.content && (
              <div className="rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto">
                {viewWorksheet.content}
              </div>
            )}

            {viewWorksheet.fileUrl && (
              <a
                href={viewWorksheet.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium transition-colors"
              >
                <FileText className="h-4 w-4" /> Open / Download File
              </a>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
