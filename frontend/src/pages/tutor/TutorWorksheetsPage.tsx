import { useState } from 'react';
import { format } from 'date-fns';
import { FileText, Trash2, Users, Trophy, Calendar, BookOpen, ClipboardList, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/shared/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { EmptyState } from '../../components/shared/EmptyState';
import { Spinner } from '../../components/ui/Loading';
import { useMyWorksheetsAsTutor, useDeleteWorksheet } from '../../hooks/use-worksheets';
import type { Worksheet } from '../../services/worksheets.service';

const TYPE_TABS = [
  { key: 'WORKSHEET', label: 'Worksheets' },
  { key: 'ASSIGNMENT', label: 'Assignments' },
];

function WorksheetCard({ worksheet, onDelete, onViewResults }: {
  worksheet: Worksheet;
  onDelete: (id: string) => void;
  onViewResults: (id: string) => void;
}) {
  const isDue = worksheet.type === 'ASSIGNMENT' && worksheet.dueDate;
  const isPast = isDue && new Date(worksheet.dueDate!) < new Date();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 dark:text-white truncate">{worksheet.title}</p>
            {worksheet.subject && <Badge variant="info">{worksheet.subject}</Badge>}
            {worksheet.type === 'ASSIGNMENT' && (
              <Badge variant={isPast ? 'danger' : 'warning'}>
                {isPast ? 'Past Due' : 'Active'}
              </Badge>
            )}
          </div>
          <div className="flex gap-4 mt-1.5 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" /> {worksheet.questions.length} questions
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {worksheet.assignedToStudentPublicIds.length === 0 ? 'All students' : `${worksheet.assignedToStudentPublicIds.length} students`}
            </span>
            {isDue && (
              <span className={`flex items-center gap-1 ${isPast ? 'text-red-400' : ''}`}>
                <Calendar className="h-3 w-3" />
                Due {format(new Date(worksheet.dueDate!), 'MMM d, h:mm a')}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Created {format(new Date(worksheet.createdAt), 'MMM d, yyyy')}
          </p>
        </div>
        <button
          onClick={() => onDelete(worksheet.publicId)}
          className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 p-1"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
        <button
          onClick={() => onViewResults(worksheet.publicId)}
          className="w-full flex items-center justify-between text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Trophy className="h-4 w-4" /> View All Student Results
          </span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function TutorWorksheetsPage() {
  const [activeType, setActiveType] = useState('WORKSHEET');

  const { data, isLoading } = useMyWorksheetsAsTutor({ type: activeType, limit: '100' });
  const { mutateAsync: deleteWorksheet } = useDeleteWorksheet();
  const navigate = useNavigate();

  const items = data?.items ?? [];

  const typeIcon = activeType === 'WORKSHEET' ? BookOpen : ClipboardList;
  const TypeIcon = typeIcon;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Worksheets & Assignments"
          subtitle="Quiz-based assessments uploaded from completed classes"
        />
      </div>

      <Tabs tabs={TYPE_TABS} activeTab={activeType} onChange={setActiveType} />

      <div className="rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 p-3 text-sm text-brand-700 dark:text-brand-300 flex items-center gap-2">
        <TypeIcon className="h-4 w-4 flex-shrink-0" />
        To create {activeType === 'WORKSHEET' ? 'a worksheet' : 'an assignment'}, go to <strong className="mx-1">My Classes → Completed</strong> and click the Upload button on any class card.
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<TypeIcon className="h-8 w-8" />}
          title={`No ${activeType === 'WORKSHEET' ? 'worksheets' : 'assignments'} yet`}
          description={`Upload an Excel quiz file from any completed class to create ${activeType === 'WORKSHEET' ? 'worksheets' : 'assignments'}.`}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((w) => (
            <WorksheetCard
              key={w.publicId}
              worksheet={w}
              onDelete={(id) => deleteWorksheet(id)}
              onViewResults={(id) => navigate(`/dashboard/tutor/worksheets/${id}/results`)}
            />
          ))}
        </div>
      )}

    </div>
  );
}
