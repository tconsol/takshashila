import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle,
  Trophy, Clock,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { CompletionCelebration } from '../../components/ui/CompletionCelebration';
import { useWorksheet, useMySubmission, useSubmitWorksheet } from '../../hooks/use-worksheets';
import type { WorksheetSubmission, IQuestion } from '../../services/worksheets.service';

// ─── Results view ─────────────────────────────────────────────────────────────

function ResultsView({
  submission,
  questions,
  onBack,
}: {
  submission: WorksheetSubmission;
  questions: IQuestion[];
  onBack: () => void;
}) {
  const scoreColor = submission.score >= 80 ? 'bg-green-500' : submission.score >= 60 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="space-y-6">
      {/* Score summary */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col items-center gap-3 text-center">
        <div className={`flex items-center justify-center h-24 w-24 rounded-full text-3xl font-bold text-white ${scoreColor}`}>
          {submission.score}%
        </div>
        <p className="text-xl font-bold text-gray-900 dark:text-white">
          {submission.correctCount} out of {submission.totalQuestions} correct
        </p>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>Submitted {format(new Date(submission.submittedAt), 'MMM d, h:mm a')}</span>
          {submission.timeTakenSeconds != null && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {Math.floor(submission.timeTakenSeconds / 60)}m {submission.timeTakenSeconds % 60}s
            </span>
          )}
        </div>
      </div>

      {/* Per-question review */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Question Review</p>
        {questions.map((q, qi) => {
          const studentAns = submission.answers[qi];
          const isCorrect = studentAns === q.correctIndex;
          return (
            <div
              key={qi}
              className={`rounded-2xl border p-4 ${isCorrect ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'}`}
            >
              <div className="flex items-start gap-2 mb-3">
                {isCorrect
                  ? <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  : <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />}
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Q{qi + 1}: {q.questionText}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                {q.options.map((opt, oi) => {
                  let cls = 'rounded-lg px-3 py-2 ';
                  if (oi === q.correctIndex) cls += 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 font-semibold border border-green-300 dark:border-green-700';
                  else if (oi === studentAns && !isCorrect) cls += 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-700';
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
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2.5 italic border-t border-current/10 pt-2.5">
                  <span className="font-medium not-italic">Explanation: </span>{q.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <Button variant="ghost" onClick={onBack} className="w-full">
        <ArrowLeft className="h-4 w-4" /> Back to Worksheets
      </Button>
    </div>
  );
}

// ─── Test taking view ─────────────────────────────────────────────────────────

function TestView({
  worksheetId,
  questions,
  title,
  onDone,
}: {
  worksheetId: string;
  questions: IQuestion[];
  title: string;
  onDone: (result: WorksheetSubmission) => void;
}) {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<number[]>(() => new Array(questions.length).fill(-1));
  const [error, setError] = useState<string | null>(null);
  const startTimeRef = useRef(Date.now());
  const { mutateAsync: submit, isPending: submitting } = useSubmitWorksheet();

  const q = questions[currentQ];
  const total = questions.length;
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
      const result = await submit({ id: worksheetId, answers, timeTakenSeconds: timeTaken });
      onDone(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    }
  };

  return (
    <div className="space-y-5">
      {/* Title */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 px-5 py-4">
        <h1 className="font-bold text-gray-900 dark:text-white text-lg">{title}</h1>
        <p className="text-xs text-gray-400 mt-0.5">{total} questions</p>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>Question {currentQ + 1} of {total}</span>
          <span>{answered}/{total} answered</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
          <div
            className="bg-brand-500 h-1.5 rounded-full transition-all"
            style={{ width: `${((currentQ + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-5">
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
            className={`w-full text-left rounded-2xl border-2 px-4 py-3.5 text-sm font-medium transition-all ${
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

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5 py-1">
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            onClick={() => setCurrentQ(i)}
            className={`h-2.5 w-2.5 rounded-full transition-colors ${
              i === currentQ
                ? 'bg-brand-500 scale-125'
                : answers[i] !== -1
                  ? 'bg-green-500'
                  : 'bg-gray-300 dark:bg-gray-600'
            }`}
          />
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-1">
        <Button
          variant="ghost"
          onClick={() => setCurrentQ((p) => Math.max(0, p - 1))}
          disabled={currentQ === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>

        {currentQ < total - 1 ? (
          <Button onClick={() => setCurrentQ((p) => p + 1)}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            variant="gradient"
            onClick={handleSubmit}
            loading={submitting}
            disabled={answered === 0}
          >
            <Trophy className="h-4 w-4" /> Submit Test
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function StudentWorksheetTestPage() {
  const { worksheetId } = useParams<{ worksheetId: string }>();
  const navigate = useNavigate();
  const [freshResult, setFreshResult] = useState<WorksheetSubmission | null>(null);
  const [celebrating, setCelebrating] = useState(false);

  const handleDone = (result: WorksheetSubmission) => {
    setFreshResult(result);
    setCelebrating(true);
  };

  const { data: worksheet, isLoading: loadingWorksheet } = useWorksheet(worksheetId ?? '');
  const { data: existingSubmission, isLoading: loadingSubmission } = useMySubmission(worksheetId ?? '');

  const isLoading = loadingWorksheet || loadingSubmission;

  const submission = freshResult ?? existingSubmission;
  const isDue = worksheet?.type === 'ASSIGNMENT' && worksheet.dueDate && new Date(worksheet.dueDate) < new Date();

  const goBack = () => navigate('/dashboard/student/worksheets');

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  if (!worksheet) {
    return (
      <div className="text-center py-24 text-gray-400">
        <p>Worksheet not found.</p>
        <Button variant="ghost" onClick={goBack} className="mt-4">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>
    );
  }

  // Back link
  const backLink = (
    <button
      onClick={goBack}
      className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-6"
    >
      <ArrowLeft className="h-4 w-4" /> Back to Worksheets
    </button>
  );

  // Already submitted → show results
  if (submission) {
    return (
      <div>
        {backLink}
        <ResultsView submission={submission} questions={worksheet.questions} onBack={goBack} />
      </div>
    );
  }

  // Overdue assignment
  if (isDue) {
    return (
      <div>
        {backLink}
        <div className="flex flex-col items-center py-24 gap-3 text-center">
          <AlertCircle className="h-12 w-12 text-red-400" />
          <p className="text-lg font-semibold text-gray-900 dark:text-white">Deadline Passed</p>
          <p className="text-sm text-gray-400">
            This assignment was due {format(new Date(worksheet.dueDate!), 'MMM d, yyyy')} and can no longer be submitted.
          </p>
        </div>
      </div>
    );
  }

  // Celebration overlay (shown immediately after submit, before results)
  if (celebrating && freshResult) {
    return (
      <CompletionCelebration
        score={freshResult.score}
        onDone={() => setCelebrating(false)}
      />
    );
  }

  // Test taking
  return (
    <div>
      {backLink}
      <TestView
        worksheetId={worksheet.publicId}
        questions={worksheet.questions}
        title={worksheet.title}
        onDone={handleDone}
      />
    </div>
  );
}
