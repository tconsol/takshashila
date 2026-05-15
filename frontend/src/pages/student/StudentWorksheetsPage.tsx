import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { FileText, CheckCircle2, Clock, Trophy, ChevronLeft, ChevronRight, AlertCircle, BookOpen, ClipboardList } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { Spinner } from '../../components/ui/Loading';
import { EmptyState } from '../../components/shared/EmptyState';
import { useMyWorksheetsAsStudent, useSubmitWorksheet } from '../../hooks/use-worksheets';
import type { Worksheet, WorksheetSubmission } from '../../services/worksheets.service';

const TYPE_TABS = [
  { key: 'WORKSHEET', label: 'Worksheets' },
  { key: 'ASSIGNMENT', label: 'Assignments' },
];

// ─── Test taking modal ────────────────────────────────────────────────────────

function TestModal({ worksheet, open, onClose }: {
  worksheet: Worksheet;
  open: boolean;
  onClose: () => void;
}) {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<number[]>(() => new Array(worksheet.questions.length).fill(-1));
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<WorksheetSubmission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startTimeRef = useRef(Date.now());

  const { mutateAsync: submit, isPending: submitting } = useSubmitWorksheet();

  const q = worksheet.questions[currentQ];
  const total = worksheet.questions.length;
  const answered = answers.filter((a) => a !== -1).length;

  const handleAnswer = (optIdx: number) => {
    setAnswers((prev) => {
      const copy = [...prev];
      copy[currentQ] = optIdx;
      return copy;
    });
  };

  const handleSubmit = async () => {
    setError(null);
    const timeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000);
    try {
      const res = await submit({ id: worksheet.publicId, answers, timeTakenSeconds: timeTaken });
      setResult(res);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    }
  };

  const handleClose = () => {
    setCurrentQ(0);
    setAnswers(new Array(worksheet.questions.length).fill(-1));
    setSubmitted(false);
    setResult(null);
    setError(null);
    startTimeRef.current = Date.now();
    onClose();
  };

  if (submitted && result) {
    return (
      <Modal open={open} onClose={handleClose} title="Test Complete!" size="xl">
        <div className="space-y-5">
          {/* Score */}
          <div className="flex flex-col items-center gap-2 py-4">
            <div className={`flex items-center justify-center h-24 w-24 rounded-full text-3xl font-bold text-white ${result.score >= 80 ? 'bg-green-500' : result.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}>
              {result.score}%
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {result.correctCount} out of {result.totalQuestions} correct
            </p>
            {result.timeTakenSeconds && (
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {Math.floor(result.timeTakenSeconds / 60)}m {result.timeTakenSeconds % 60}s
              </p>
            )}
          </div>

          {/* Per-question review */}
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 pb-2">
              Question Review
            </p>
            {worksheet.questions.map((q, qi) => {
              const studentAns = result.answers[qi];
              const isCorrect = studentAns === q.correctIndex;
              return (
                <div key={qi} className={`rounded-xl border p-4 ${isCorrect ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'}`}>
                  <div className="flex items-start gap-2 mb-2">
                    {isCorrect
                      ? <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      : <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />}
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Q{qi + 1}: {q.questionText}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    {q.options.map((opt, oi) => {
                      let cls = 'rounded-lg px-3 py-1.5 ';
                      if (oi === q.correctIndex) cls += 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-semibold border border-green-300 dark:border-green-700';
                      else if (oi === studentAns && !isCorrect) cls += 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700';
                      else cls += 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400';
                      return (
                        <div key={oi} className={cls}>
                          {String.fromCharCode(65 + oi)}. {opt}
                          {oi === q.correctIndex && ' ✓'}
                          {oi === studentAns && !isCorrect && ' ✗ (your answer)'}
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic border-t border-current/10 pt-2">
                      <span className="font-medium not-italic">Explanation: </span>{q.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end pt-4">
          <Button onClick={handleClose}>Done</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title={worksheet.title} size="xl">
      <div className="space-y-5">
        {/* Progress */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            Question {currentQ + 1} of {total}
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            {answered}/{total} answered
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
          <div
            className="bg-brand-500 h-1.5 rounded-full transition-all"
            style={{ width: `${((currentQ + 1) / total) * 100}%` }}
          />
        </div>

        {/* Question */}
        <div className="rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-base font-semibold text-gray-900 dark:text-white leading-relaxed">
            {q.questionText}
          </p>
        </div>

        {/* Options */}
        <div className="space-y-2.5">
          {q.options.map((opt, oi) => (
            <button
              key={oi}
              onClick={() => handleAnswer(oi)}
              className={`w-full text-left rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all ${
                answers[currentQ] === oi
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                  : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-brand-300 hover:bg-brand-50/50 dark:hover:bg-brand-900/10'
              }`}
            >
              <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full mr-3 text-xs font-bold ${
                answers[currentQ] === oi
                  ? 'bg-brand-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
              }`}>
                {String.fromCharCode(65 + oi)}
              </span>
              {opt}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-500 flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" /> {error}
          </p>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            onClick={() => setCurrentQ((p) => Math.max(0, p - 1))}
            disabled={currentQ === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>

          <div className="flex gap-1">
            {Array.from({ length: total }, (_, i) => (
              <button
                key={i}
                onClick={() => setCurrentQ(i)}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  i === currentQ
                    ? 'bg-brand-500'
                    : answers[i] !== -1
                      ? 'bg-green-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>

          {currentQ < total - 1 ? (
            <Button onClick={() => setCurrentQ((p) => p + 1)}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              loading={submitting}
              disabled={answered === 0}
            >
              Submit Test
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Completed result preview modal ───────────────────────────────────────────

function ViewResultModal({ worksheet, submission, open, onClose }: {
  worksheet: Worksheet;
  submission: WorksheetSubmission;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={`Results: ${worksheet.title}`} size="xl">
      <div className="space-y-4">
        <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
          <div className={`flex items-center justify-center h-16 w-16 rounded-full text-xl font-bold text-white flex-shrink-0 ${submission.score >= 80 ? 'bg-green-500' : submission.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}>
            {submission.score}%
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">{submission.correctCount}/{submission.totalQuestions} correct</p>
            <p className="text-sm text-gray-400">Submitted {format(new Date(submission.submittedAt), 'MMM d, h:mm a')}</p>
            {submission.timeTakenSeconds && (
              <p className="text-xs text-gray-400">{Math.floor(submission.timeTakenSeconds / 60)}m {submission.timeTakenSeconds % 60}s</p>
            )}
          </div>
        </div>

        <div className="space-y-3 max-h-[50vh] overflow-y-auto">
          {worksheet.questions.map((q, qi) => {
            const studentAns = submission.answers[qi];
            const isCorrect = studentAns === q.correctIndex;
            return (
              <div key={qi} className={`rounded-xl border p-4 ${isCorrect ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'}`}>
                <div className="flex items-start gap-2 mb-2">
                  {isCorrect
                    ? <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    : <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />}
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Q{qi + 1}: {q.questionText}</p>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {q.options.map((opt, oi) => {
                    let cls = 'rounded-lg px-3 py-1.5 ';
                    if (oi === q.correctIndex) cls += 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-semibold border border-green-300';
                    else if (oi === studentAns && !isCorrect) cls += 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-300';
                    else cls += 'bg-white dark:bg-gray-800 text-gray-500';
                    return (
                      <div key={oi} className={cls}>
                        {String.fromCharCode(65 + oi)}. {opt}
                        {oi === q.correctIndex && ' ✓'}
                        {oi === studentAns && !isCorrect && ' ✗'}
                      </div>
                    );
                  })}
                </div>
                {q.explanation && !isCorrect && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic border-t border-current/10 pt-2">
                    <span className="font-medium not-italic">Explanation: </span>{q.explanation}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function StudentWorksheetsPage() {
  const [activeType, setActiveType] = useState('WORKSHEET');
  const [testTarget, setTestTarget] = useState<Worksheet | null>(null);
  const [resultTarget, setResultTarget] = useState<{ worksheet: Worksheet; submission: WorksheetSubmission } | null>(null);

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
                    <span>{w.questions.length} questions</span>
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
                  {sub ? (
                    <button
                      onClick={() => setResultTarget({ worksheet: w, submission: sub })}
                      className="w-full text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline flex items-center justify-center gap-1.5"
                    >
                      <Trophy className="h-3.5 w-3.5" /> View My Results
                    </button>
                  ) : (
                    <button
                      onClick={() => setTestTarget(w)}
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

      {testTarget && (
        <TestModal
          worksheet={testTarget}
          open={!!testTarget}
          onClose={() => setTestTarget(null)}
        />
      )}

      {resultTarget && (
        <ViewResultModal
          worksheet={resultTarget.worksheet}
          submission={resultTarget.submission}
          open={!!resultTarget}
          onClose={() => setResultTarget(null)}
        />
      )}
    </div>
  );
}
