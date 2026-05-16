import { useState } from 'react';
import { format } from 'date-fns';
import { FolderOpen, Download, Search, ExternalLink } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { Spinner } from '../../components/ui/Loading';
import { useMyResourcesAsStudent } from '../../hooks/use-resources';
import { resourcesService } from '../../services/resources.service';

function mimeLabel(mimeType: string): string {
  const map: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/vnd.ms-powerpoint': 'PPT',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
    'application/vnd.ms-excel': 'XLS',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'text/plain': 'TXT',
    'image/jpeg': 'JPG', 'image/png': 'PNG', 'image/webp': 'WEBP',
  };
  return map[mimeType] ?? 'FILE';
}

function mimeColor(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400';
  if (mimeType.includes('word')) return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400';
  if (mimeType.startsWith('image/')) return 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400';
  return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
}

export function StudentResourcesPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useMyResourcesAsStudent({ limit: '100' });
  const items = data?.items ?? [];

  const filtered = items.filter((r) =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    (r.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
    r.fileName.toLowerCase().includes(search.toLowerCase()),
  );

  const handleOpen = async (id: string) => {
    try {
      const url = await resourcesService.getReadUrl(id);
      window.open(url, '_blank');
    } catch { /* silent */ }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resources"
        subtitle={`${items.length} resource${items.length !== 1 ? 's' : ''} from your tutor`}
      />

      {items.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search resources…"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-8 w-8" />}
          title={search ? 'No matching resources' : 'No resources yet'}
          description={search ? 'Try a different search.' : 'Your tutor will upload study materials here.'}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => (
            <div
              key={r.publicId}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold ${mimeColor(r.mimeType)}`}>
                  {mimeLabel(r.mimeType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white leading-snug truncate">{r.title}</p>
                  {r.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{r.description}</p>}
                </div>
              </div>

              <div className="flex gap-3 text-xs text-gray-400">
                <span className="truncate">{r.fileName}</span>
                <span className="flex-shrink-0">{(r.sizeBytes / 1024).toFixed(0)} KB</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700 mt-auto">
                <span className="text-xs text-gray-400">{format(new Date(r.createdAt), 'MMM d, yyyy')}</span>
                <button
                  onClick={() => handleOpen(r.publicId)}
                  className="flex items-center gap-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
