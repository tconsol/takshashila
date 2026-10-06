// frontend/src/pages/student/StudentMyCoursesPage.tsx
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Inbox } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { useMyCourses, useCancelCourse } from '../../hooks/use-courses';
import { useConfirm } from '../../hooks/use-confirm';
import { formatCredits } from '../../lib/billing';

const STATUS_BADGE = {
  PENDING: <Badge variant="warning" tone="soft">Pending</Badge>,
  ACCEPTED: <Badge variant="success" tone="soft">Accepted</Badge>,
  REJECTED: <Badge variant="danger" tone="soft">Rejected</Badge>,
  CANCELLED: <Badge variant="default" tone="soft">Cancelled</Badge>,
  COMPLETED: <Badge variant="info" tone="soft">Completed</Badge>,
} as const;

export function StudentMyCoursesPage() {
  const { data, isLoading } = useMyCourses({ limit: '50' });
  const { mutate: cancel, isPending: cancelling } = useCancelCourse();
  const { confirm, confirmDialog } = useConfirm();
  const navigate = useNavigate();
  const requests = data?.items ?? [];

  return (
    <div className="animate-fade-in">
      {confirmDialog}
      <PageHeader eyebrow="Courses" title="My courses" icon={<ClipboardList className="h-5 w-5" />} />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-14 text-center gap-3">
              <Inbox className="h-6 w-6 text-gray-400" />
              <p className="text-sm text-gray-500">No courses yet. Browse the curriculum, pick topics and send a course to a tutor.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <Card
              key={req.publicId}
              role="link"
              tabIndex={0}
              onClick={() => navigate(`/dashboard/student/courses/${req.publicId}`)}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/dashboard/student/courses/${req.publicId}`); }}
              className="cursor-pointer hover:border-brand-300"
            >
              <CardContent>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    {STATUS_BADGE[req.status]}
                    {req.curriculumTitle && <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{req.curriculumTitle}</p>}
                    <p className="mt-1 text-xs text-gray-500">
                      {req.tutorName ? `with ${req.tutorName}` : 'Tutor'}
                      {req.topicTitles && req.topicTitles.length > 0 && ` · ${req.topicTitles.slice(0, 3).join(', ')}${req.topicTitles.length > 3 ? '…' : ''}`}
                    </p>
                    {req.status === 'ACCEPTED' && (
                      <p className="mt-1 text-xs text-gray-500">
                        {req.classesCompletedCount} of {req.classesRequired} classes completed ·{' '}
                        {req.classesScheduledCount} scheduled
                        {req.costCentsPerClass ? ` · ${formatCredits(req.costCentsPerClass)} cr per class` : ''}
                      </p>
                    )}
                    {req.status === 'ACCEPTED' && req.billing === 'HELD' && req.classesRequired && req.costCentsPerClass ? (
                      <p className="mt-1 text-xs text-gray-500">
                        {formatCredits(Math.max(0, req.classesRequired - req.classesCompletedCount) * req.costCentsPerClass)} cr on hold for the classes still to take
                      </p>
                    ) : null}
                    {req.status === 'REJECTED' && req.rejectionReason && (
                      <p className="mt-1 text-xs text-red-500">Reason: {req.rejectionReason}</p>
                    )}
                  </div>
                  {(req.status === 'PENDING' || req.status === 'ACCEPTED') && (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={cancelling}
                      onClick={async (e) => {
                        e.stopPropagation();
                        const { confirmed } = await confirm({
                          title: 'Cancel this course?',
                          message: req.status === 'ACCEPTED'
                            ? 'Classes already scheduled will be cancelled and the credits on hold for the rest are released. Completed classes stay charged.'
                            : 'The request is withdrawn and the tutor is told.',
                          confirmLabel: 'Cancel course',
                          tone: 'danger',
                        });
                        if (confirmed) cancel(req.publicId);
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
