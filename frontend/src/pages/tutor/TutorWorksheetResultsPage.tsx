import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Trophy, CheckCircle2, AlertCircle, Clock, Users } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { useWorksheet, useWorksheetSubmissions } from '../../hooks/use-worksheets';
import type { WorksheetSubmission } from '../../services/worksheets.service';

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className={`flex items-center justify-center h-14 w-14 rounded-full text-lg font-bold text-white flex-shrink-0 ${color}`}>
      {score}%
    </div>
  );
}

function SubmissionCard({ submission, questions }: {
  submission: WorksheetSubmission;
  questions: { questionText: string; options: string[]; correctIndex: number; explanation: string }[];
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3 min-w-0">
          <ScoreBadge score={submission.score} />
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white truncate">
              {submission.studentName ?? submission.studentPublicId}
            </p>
            <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
              <span className="flex items-center gap-1">
                <Trophy className="h-3 w-3" />
                {submission.correctCount}/{submission.totalQuestions} correct
              </span>
              {submission.timeTakenSeconds != null && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {Math.floor(submission.timeTakenSeconds / 60)}m {submission.timeTakenSeconds % 60}s
                </span>
              )}
              <span>Submitted {format(new Date(submission.submittedAt), 'MMM d, h:mm a')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Per-question breakdown */}
      <div className="p-4 space-y-2">
        {questions.map((q, qi) => {
          const studentAns = submission.answers[qi];
          const isCorrect = studentAns === q.correctIndex;
          return (
            <div
              key={qi}
              className={`rounded-xl p-3 text-xs ${isCorrect ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}
            >
              <div className="flex items-start gap-2 mb-2">
                {isCorrect
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                  : <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />}
                <p className={`font-medium ${isCorrect ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                  Q{qi + 1}: {q.questionText}
                </p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] pl-5">
                <span>
                  Student: <strong className={isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    {studentAns === -1 ? 'Skipped' : `${String.fromCharCode(65 + studentAns)}. ${q.options[studentAns] ?? '?'}`}
                  </strong>
                </span>
                {!isCorrect && (
                  <span>
                    Correct: <strong className="text-green-600 dark:text-green-400">
                      {String.fromCharCode(65 + q.correctIndex)}. {q.options[q.correctIndex]}
                    </strong>
                  </span>
                )}
              </div>
              {!isCorrect && q.explanation && (
                <p className="text-gray-500 dark:text-gray-400 mt-1.5 pl-5 italic">{q.explanation}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TutorWorksheetResultsPage() {
  const { worksheetId } = useParams<{ worksheetId: string }>();
  const navigate = useNavigate();

  const { data: worksheet, isLoading: loadingWorksheet } = useWorksheet(worksheetId ?? '');
  const { data: submissions = [], isLoading: loadingSubmissions } = useWorksheetSubmissions(worksheetId ?? '');

  const isLoading = loadingWorksheet || loadingSubmissions;

  const avgScore = submissions.length > 0
    ? Math.round(submissions.reduce((s, sub) => s + sub.score, 0) / submissions.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Back */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/dashboard/tutor/worksheets')}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Worksheets
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : !worksheet ? (
        <div className="text-center py-20 text-gray-400">Worksheet not found</div>
      ) : (
        <>
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{worksheet.title}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {worksheet.questions.length} questions
                  {worksheet.subject && ` · ${worksheet.subject}`}
                  {' · '}Created {format(new Date(worksheet.createdAt), 'MMM d, yyyy')}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{submissions.length}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1"><Users className="h-3 w-3" /> Submissions</p>
                </div>
                {submissions.length > 0 && (
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${avgScore >= 80 ? 'text-green-600' : avgScore >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {avgScore}%
                    </p>
                    <p className="text-xs text-gray-400">Class Average</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submissions */}
          {submissions.length === 0 ? (
            <div className="flex flex-col items-center py-20 gap-3 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
                <Trophy className="h-7 w-7 text-gray-400" />
              </div>
              <p className="font-medium text-gray-700 dark:text-gray-300">No submissions yet</p>
              <p className="text-sm text-gray-400 max-w-xs">Students haven't completed this worksheet yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
              </p>
              {submissions.map((sub) => (
                <SubmissionCard key={sub.publicId} submission={sub} questions={worksheet.questions} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
