import { useState } from 'react';
import { format, isPast } from 'date-fns';
import { Download } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { MediaUpload } from '../../components/shared/MediaUpload';
import { useMyClassesAsStudent } from '../../hooks/use-classes';
import { useAssignmentsByClass, useMySubmission, useSubmitAssignment } from '../../hooks/use-assignments';
import type { Assignment } from '../../services/assignments.service';
import { api } from '../../lib/axios';

type StatusVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const assignmentStatusVariant: Record<string, StatusVariant> = {
  PUBLISHED: 'info',
  CLOSED: 'default',
};

const submissionStatusVariant: Record<string, StatusVariant> = {
  NOT_SUBMITTED: 'default',
  SUBMITTED: 'warning',
  GRADED: 'success',
  LATE: 'danger',
};

function AssignmentRow({ assignment }: { assignment: Assignment }) {
  const [showSubmit, setShowSubmit] = useState(false);
  const [content, setContent] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { data: submission, isLoading: loadingSubmission } = useMySubmission(assignment.publicId);
  const { mutateAsync: submit, isPending: submitting } = useSubmitAssignment();

  const isOverdue = isPast(new Date(assignment.dueDate));
  const canSubmit = assignment.status === 'PUBLISHED' && (!submission || submission.status === 'NOT_SUBMITTED');

  const handleSubmit = async () => {
    setSubmitError(null);
    try {
      await submit({ id: assignment.publicId, dto: { content } });
      setShowSubmit(false);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Submission failed');
    }
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <p className="font-semibold text-gray-900 dark:text-white">{assignment.title}</p>
              <Badge variant={assignmentStatusVariant[assignment.status] ?? 'default'}>{assignment.status}</Badge>
              {!loadingSubmission && submission && (
                <Badge variant={submissionStatusVariant[submission.status] ?? 'default'}>
                  {submission.status.replace('_', ' ')}
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{assignment.description}</p>
            <div className="flex gap-4 mt-2 text-xs text-gray-400 flex-wrap">
              <span className={isOverdue && canSubmit ? 'text-red-500 font-medium' : ''}>
                Due: {format(new Date(assignment.dueDate), 'MMM d, yyyy h:mm a')}
                {isOverdue && canSubmit && ' (overdue)'}
              </span>
              <span>Max: {assignment.maxScore} pts</span>
              {submission?.score !== undefined && (
                <span className="text-green-600 dark:text-green-400 font-medium">
                  Score: {submission.score}/{assignment.maxScore}
                </span>
              )}
            </div>
            {submission?.feedback && (
              <div className="mt-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-xs text-green-800 dark:text-green-300">
                Feedback: {submission.feedback}
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {assignment.isFileAttachment && assignment.filePublicId && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const { data } = await api.get(`/media/${assignment.filePublicId}/read-url`);
                  window.open(data.data.url, '_blank');
                }}
              >
                <Download className="h-3.5 w-3.5 mr-1" />{assignment.fileOriginalName ?? 'Download'}
              </Button>
            )}
            {canSubmit && (
              <Button size="sm" onClick={() => setShowSubmit(true)}>
                {submission?.status === 'NOT_SUBMITTED' ? 'Submit' : 'Resubmit'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={showSubmit}
        onClose={() => setShowSubmit(false)}
        title={`Submit: ${assignment.title}`}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowSubmit(false)}>Cancel</Button>
            <Button onClick={handleSubmit} loading={submitting}>Submit Assignment</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Your Answer
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Write your answer here…"
            />
          </div>
          <MediaUpload
            mediaType="ASSIGNMENT_SUBMISSION"
            entityPublicId={assignment.publicId}
            entityType="ASSIGNMENT"
            accept=".pdf,.doc,.docx,.zip,.png,.jpg"
            label="Attach files (optional)"
          />
          {submitError && <p className="text-xs text-red-500">{submitError}</p>}
        </div>
      </Modal>
    </>
  );
}

function ClassAssignments({ classPublicId, subject }: { classPublicId: string; subject: string }) {
  const { data: assignments = [], isLoading } = useAssignmentsByClass(classPublicId);

  if (isLoading) return (
    <div className="py-4 flex justify-center">
      <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (assignments.length === 0) return null;

  return (
    <div>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{subject}</p>
      <div className="space-y-3">
        {assignments.map((a) => <AssignmentRow key={a.publicId} assignment={a} />)}
      </div>
    </div>
  );
}

export function StudentAssignmentsPage() {
  const { data: classData, isLoading: loadingClasses } = useMyClassesAsStudent({ limit: '50' });
  const classes = classData?.items ?? [];

  const completedClasses = classes.filter((c) => c.status === 'COMPLETED' || c.status === 'SCHEDULED');
  const uniqueClasses = completedClasses.filter(
    (c, i, arr) => arr.findIndex((x) => x.publicId === c.publicId) === i,
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Assignments" subtitle="View and submit your assignments" />

      {loadingClasses ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : uniqueClasses.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          No assignments yet. Assignments will appear once your classes begin.
        </div>
      ) : (
        <div className="space-y-6">
          {uniqueClasses.map((cls) => (
            <ClassAssignments
              key={cls.publicId}
              classPublicId={cls.publicId}
              subject={cls.subject}
            />
          ))}
        </div>
      )}
    </div>
  );
}
