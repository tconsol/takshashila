// frontend/src/pages/student/StudentCourseRequestsPage.tsx
import { ClipboardList, Inbox } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { useCourseRequestsAsStudent, useCancelCourseRequest } from '../../hooks/use-course-requests';

const STATUS_BADGE = {
  PENDING: <Badge variant="warning" tone="soft">Pending</Badge>,
  ACCEPTED: <Badge variant="success" tone="soft">Accepted</Badge>,
  REJECTED: <Badge variant="danger" tone="soft">Rejected</Badge>,
  CANCELLED: <Badge variant="default" tone="soft">Cancelled</Badge>,
  COMPLETED: <Badge variant="info" tone="soft">Completed</Badge>,
} as const;

export function StudentCourseRequestsPage() {
  const { data, isLoading } = useCourseRequestsAsStudent({ limit: '50' });
  const { mutate: cancel, isPending: cancelling } = useCancelCourseRequest();
  const requests = data?.items ?? [];

  return (
    <div className="animate-fade-in">
      <PageHeader eyebrow="Courses" title="My Course Requests" icon={<ClipboardList className="h-5 w-5" />} />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-14 text-center gap-3">
              <Inbox className="h-6 w-6 text-gray-400" />
              <p className="text-sm text-gray-500">No course requests yet. Browse the curriculum to get started.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <Card key={req.publicId}>
              <CardContent>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    {STATUS_BADGE[req.status]}
                    {req.courseTitle && <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{req.courseTitle}</p>}
                    {req.status === 'ACCEPTED' && (
                      <p className="mt-1 text-xs text-gray-500">
                        {req.classesCompletedCount} of {req.classesRequired} classes completed ·{' '}
                        {req.classesScheduledCount} scheduled
                      </p>
                    )}
                    {req.status === 'REJECTED' && req.rejectionReason && (
                      <p className="mt-1 text-xs text-red-500">Reason: {req.rejectionReason}</p>
                    )}
                  </div>
                  {(req.status === 'PENDING' || req.status === 'ACCEPTED') && (
                    <Button size="sm" variant="outline" loading={cancelling} onClick={() => cancel(req.publicId)}>
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
