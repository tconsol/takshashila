// frontend/src/pages/student/StudentAssignmentDetailPage.tsx
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Download } from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { useAssignment, useMySubmission, useSubmitAssignment } from '../../hooks/use-assignments';
import { api } from '../../lib/axios';

export function StudentAssignmentDetailPage() {
  const { assignmentId = '' } = useParams<{ assignmentId: string }>();
  const { data: assignment, isLoading, isError } = useAssignment(assignmentId);
  const { data: submission } = useMySubmission(assignmentId);
  const { mutate: submit, isPending } = useSubmitAssignment();
  const [content, setContent] = useState('');

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (isError || !assignment) {
    return <div className="py-16 text-center text-sm text-gray-500">Assignment not found. <Link to="/dashboard/student/assignments" className="text-brand-600 hover:underline">Back</Link></div>;
  }

  const openAttachment = async () => {
    const { data } = await api.get(`/media/${assignment.filePublicId}/read-url`);
    window.open((data.data as { url: string }).url, '_blank');
  };

  return (
    <div className="animate-fade-in">
      <button type="button" onClick={() => history.back()} className="mb-3 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>
      <PageHeader
        eyebrow="Assignment"
        title={assignment.title}
        description={assignment.dueDate ? `Due ${format(new Date(assignment.dueDate), 'MMM d, yyyy h:mm a')}` : 'No due date'}
        icon={<ClipboardList className="h-5 w-5" />}
      />
      <Card className="mb-4">
        <CardContent className="space-y-3">
          <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{assignment.description}</p>
          {assignment.isFileAttachment && assignment.filePublicId && (
            <Button size="sm" variant="outline" onClick={openAttachment}>
              <Download className="h-3.5 w-3.5" /> {assignment.fileOriginalName ?? 'Attachment'}
            </Button>
          )}
          <p className="text-xs text-gray-500">Max score: {assignment.maxScore}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3">
          {submission && submission.status !== 'NOT_SUBMITTED' ? (
            <>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">Your submission</p>
                <Badge variant={submission.status === 'GRADED' ? 'success' : submission.status === 'LATE' ? 'danger' : 'warning'} tone="soft">{submission.status}</Badge>
              </div>
              <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{submission.content}</p>
              {submission.status === 'GRADED' && (
                <p className="text-sm">Score: <strong>{submission.score}</strong> / {assignment.maxScore}{submission.feedback ? ` — ${submission.feedback}` : ''}</p>
              )}
            </>
          ) : assignment.status === 'PUBLISHED' ? (
            <>
              <p className="text-sm font-semibold">Your answer</p>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="Write your answer…"
              />
              <Button variant="gradient" loading={isPending} disabled={!content.trim()} onClick={() => submit({ id: assignmentId, dto: { content: content.trim() } })}>
                Submit
              </Button>
            </>
          ) : (
            <p className="text-sm text-gray-500">This assignment is closed.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
