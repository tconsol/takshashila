import { useState } from 'react';
import { format } from 'date-fns';
import { FileText, Trash2, Users, Trophy, Calendar, BookOpen, ClipboardList, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/shared/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/shared/EmptyState';
import { Spinner } from '../../components/ui/Loading';
import { useMyWorksheetsAsTutor, useDeleteWorksheet, useWorksheetSubmissions } from '../../hooks/use-worksheets';
import type { Worksheet } from '../../services/worksheets.service';

const TYPE_TABS = [
  { key: 'WORKSHEET', label: 'Worksheets' },
  { key: 'ASSIGNMENT', label: 'Assignments' },
];

function WorksheetCard({ worksheet, onDelete, onViewResults }: {
  worksheet: Worksheet;
  onDelete: (id: string) => void;
  onViewResults: (worksheet: Worksheet) => void;
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
          onClick={() => onViewResults(worksheet)}
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

function ResultsModal({ worksheet, open, onClose }: {
  worksheet: Worksheet | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data: submissions = [], isLoading } = useWorksheetSubmissions(worksheet?.publicId ?? '');

  if (!worksheet) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Results: ${worksheet.title}`} size="xl">
      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Trophy className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No submissions yet</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 pb-2 border-b border-gray-100 dark:border-gray-700">
            <span>{submissions.length} submission{submissions.length !== 1 ? 's' : ''}</span>
            <span>
              Avg: {Math.round(submissions.reduce((s, sub) => s + sub.score, 0) / submissions.length)}%
            </span>
          </div>
          {submissions.map((sub) => (
            <div key={sub.publicId} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Student: {sub.studentPublicId.slice(0, 8)}…
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Submitted {format(new Date(sub.submittedAt), 'MMM d, h:mm a')}
                    {sub.timeTakenSeconds && ` · ${Math.floor(sub.timeTakenSeconds / 60)}m ${sub.timeTakenSeconds % 60}s`}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-2xl font-bold ${sub.score >= 80 ? 'text-green-500' : sub.score >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                    {sub.score}%
                  </span>
                  <p className="text-xs text-gray-400">{sub.correctCount}/{sub.totalQuestions} correct</p>
                </div>
              </div>

              {/* Per-question breakdown */}
              <div className="mt-3 grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
                {worksheet.questions.map((q, qi) => {
                  const studentAns = sub.answers[qi];
                  const isCorrect = studentAns === q.correctIndex;
                  return (
                    <div key={qi} className={`rounded-lg p-2.5 text-xs ${isCorrect ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                      <p className={`font-medium mb-1 ${isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        Q{qi + 1}: {q.questionText.slice(0, 80)}{q.questionText.length > 80 ? '…' : ''}
                      </p>
                      <div className="flex gap-4 text-[11px]">
                        <span>
                          Student: <strong className={isCorrect ? 'text-green-600' : 'text-red-600'}>
                            {studentAns === -1 ? 'Skipped' : `${String.fromCharCode(65 + studentAns)}. ${q.options[studentAns] ?? '?'}`}
                          </strong>
                        </span>
                        {!isCorrect && (
                          <span>
                            Correct: <strong className="text-green-600">
                              {String.fromCharCode(65 + q.correctIndex)}. {q.options[q.correctIndex]}
                            </strong>
                          </span>
                        )}
                      </div>
                      {!isCorrect && q.explanation && (
                        <p className="text-gray-500 dark:text-gray-400 mt-1 italic">{q.explanation}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function TutorWorksheetsPage() {
  const [activeType, setActiveType] = useState('WORKSHEET');
  const [viewResultsFor, setViewResultsFor] = useState<Worksheet | null>(null);

  const { data, isLoading } = useMyWorksheetsAsTutor({ type: activeType, limit: '100' });
  const { mutateAsync: deleteWorksheet } = useDeleteWorksheet();

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
              onViewResults={setViewResultsFor}
            />
          ))}
        </div>
      )}

      <ResultsModal
        worksheet={viewResultsFor}
        open={!!viewResultsFor}
        onClose={() => setViewResultsFor(null)}
      />
    </div>
  );
}
