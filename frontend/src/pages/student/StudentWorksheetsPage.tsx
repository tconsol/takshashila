import { useState } from 'react';
import { format } from 'date-fns';
import { FileText, Clock, Trophy, BookOpen, ClipboardList, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/shared/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { Spinner } from '../../components/ui/Loading';
import { EmptyState } from '../../components/shared/EmptyState';
import { useMyWorksheetsAsStudent } from '../../hooks/use-worksheets';
import type { Worksheet } from '../../services/worksheets.service';
import { api } from '../../lib/axios';

const TYPE_TABS = [
  { key: 'WORKSHEET', label: 'Worksheets' },
  { key: 'ASSIGNMENT', label: 'Assignments' },
];

export function StudentWorksheetsPage() {
  const [activeType, setActiveType] = useState('WORKSHEET');
  const navigate = useNavigate();

  const { data, isLoading } = useMyWorksheetsAsStudent({ type: activeType, limit: '100' });
  const items = data?.items ?? [];

  const isDue = (w: Worksheet): boolean => w.type === 'ASSIGNMENT' && !!w.dueDate && new Date(w.dueDate) < new Date();

  return (
    <div className="space-y-6">
      <PageHeader
        title={activeType === 'WORKSHEET' ? 'Worksheets' : 'Assignments'}
        subtitle="Quiz assessments from your tutor"
      />

      <Tabs tabs={TYPE_TABS} activeTab={activeType} onChange={setActiveType} />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={activeType === 'WORKSHEET' ? <BookOpen className="h-8 w-8" /> : <ClipboardList className="h-8 w-8" />}
          title={`No ${activeType === 'WORKSHEET' ? 'worksheets' : 'assignments'} yet`}
          description="Your tutor will share quiz assessments here."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((w) => {
            const sub = w.mySubmission;
            const overdue = isDue(w);
            return (
              <div
                key={w.publicId}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-900/30">
                    {sub ? (
                      <Trophy className={`h-5 w-5 ${sub.score >= 80 ? 'text-green-500' : sub.score >= 60 ? 'text-yellow-500' : 'text-red-500'}`} />
                    ) : (
                      <FileText className="h-5 w-5 text-brand-500" />
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {w.subject && <Badge variant="info">{w.subject}</Badge>}
                    {sub ? (
                      <Badge variant={sub.score >= 80 ? 'success' : sub.score >= 60 ? 'warning' : 'danger'}>
                        {sub.score}%
                      </Badge>
                    ) : overdue ? (
                      <Badge variant="danger">Overdue</Badge>
                    ) : (
                      <Badge variant="default">Pending</Badge>
                    )}
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-gray-900 dark:text-white leading-snug">{w.title}</p>
                  <div className="flex gap-3 mt-1 text-xs text-gray-400">
                    <span>{w.isFileAttachment ? (w.fileOriginalName ?? 'File attachment') : `${w.questions.length} questions`}</span>
                    {w.dueDate && (
                      <span className={`flex items-center gap-1 ${overdue && !sub ? 'text-red-400' : ''}`}>
                        <Clock className="h-3 w-3" />
                        Due {format(new Date(w.dueDate), 'MMM d')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {format(new Date(w.createdAt), 'MMM d, yyyy')}
                  </p>
                </div>

                <div className="pt-2 border-t border-gray-100 dark:border-gray-700 mt-auto">
                  {w.isFileAttachment ? (
                    <button
                      onClick={async () => {
                        if (!w.filePublicId) return;
                        const { data } = await api.get(`/media/${w.filePublicId}/read-url`);
                        window.open(data.data.url, '_blank');
                      }}
                      className="w-full text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg py-2 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Download className="h-3.5 w-3.5" /> Download File
                    </button>
                  ) : sub ? (
                    <button
                      onClick={() => navigate(`/dashboard/student/worksheets/${w.publicId}/test`)}
                      className="w-full text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline flex items-center justify-center gap-1.5"
                    >
                      <Trophy className="h-3.5 w-3.5" /> View My Results
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate(`/dashboard/student/worksheets/${w.publicId}/test`)}
                      disabled={overdue}
                      className="w-full text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg py-2 transition-colors"
                    >
                      {overdue ? 'Deadline Passed' : 'Start Test'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
