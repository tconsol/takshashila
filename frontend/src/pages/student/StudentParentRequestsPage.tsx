import { useState } from 'react';
import { UserCheck, UserX, Users, CheckCircle, XCircle, Clock } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { Modal } from '../../components/ui/Modal';
import { useParentLinkRequests, useApproveParentRequest, useRejectParentRequest } from '../../hooks/use-student-parent-requests';
import type { ParentLinkRequest } from '../../hooks/use-student-parent-requests';

function RequestCard({
  request,
  onApprove,
  onReject,
}: {
  request: ParentLinkRequest;
  onApprove: (r: ParentLinkRequest) => void;
  onReject: (r: ParentLinkRequest) => void;
}) {
  const parentName = `${request.parent.firstName} ${request.parent.lastName}`.trim() || 'Unknown';
  const date = new Date(request.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <Avatar name={parentName} size="lg" className="shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-900 text-base">{parentName}</p>
        {request.parent.email && (
          <p className="text-sm text-slate-500 truncate">{request.parent.email}</p>
        )}
        <div className="flex items-center gap-1.5 mt-1">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs text-slate-400">Requested {date}</span>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="border-rose-200 text-rose-600 hover:bg-rose-50"
          onClick={() => onReject(request)}
        >
          <UserX className="h-3.5 w-3.5 mr-1" />Decline
        </Button>
        <Button
          size="sm"
          onClick={() => onApprove(request)}
        >
          <UserCheck className="h-3.5 w-3.5 mr-1" />Accept
        </Button>
      </div>
    </div>
  );
}

function ConfirmModal({
  request,
  action,
  onConfirm,
  onClose,
  isPending,
}: {
  request: ParentLinkRequest;
  action: 'approve' | 'reject';
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const parentName = `${request.parent.firstName} ${request.parent.lastName}`.trim() || 'Unknown';
  const isApprove = action === 'approve';

  return (
    <Modal open onClose={onClose} title={isApprove ? 'Accept Parent Link' : 'Decline Parent Link'}>
      <div className="flex flex-col gap-5">
        <div className={`rounded-xl border p-4 flex items-start gap-3 ${isApprove ? 'border-indigo-200 bg-indigo-50' : 'border-rose-200 bg-rose-50'}`}>
          {isApprove
            ? <UserCheck className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
            : <UserX className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          }
          <div>
            <p className={`font-medium text-sm ${isApprove ? 'text-indigo-900' : 'text-rose-900'}`}>
              {isApprove
                ? `Allow ${parentName} to see your profile, classes, and attendance?`
                : `Are you sure you want to decline ${parentName}'s request?`
              }
            </p>
            <p className={`text-xs mt-1 ${isApprove ? 'text-indigo-700' : 'text-rose-700'}`}>
              {isApprove
                ? 'They will be linked as your parent/guardian and can monitor your progress.'
                : 'They will need to send a new request if they want to connect later.'
              }
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            className={`flex-1 ${!isApprove ? 'bg-rose-600 hover:bg-rose-700' : ''}`}
            loading={isPending}
            onClick={onConfirm}
          >
            {isApprove ? <><CheckCircle className="h-4 w-4 mr-1" />Accept</> : <><XCircle className="h-4 w-4 mr-1" />Decline</>}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function StudentParentRequestsPage() {
  const { data: requests = [], isLoading } = useParentLinkRequests();
  const { mutateAsync: approve, isPending: approving } = useApproveParentRequest();
  const { mutateAsync: reject, isPending: rejecting } = useRejectParentRequest();

  const [selected, setSelected] = useState<{ request: ParentLinkRequest; action: 'approve' | 'reject' } | null>(null);

  const handleConfirm = async () => {
    if (!selected) return;
    if (selected.action === 'approve') {
      await approve(selected.request.publicId);
    } else {
      await reject(selected.request.publicId);
    }
    setSelected(null);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Parent Requests"
        subtitle="Review and manage requests from parents who want to link to your account"
        icon={<Users className="h-6 w-6" />}
      />

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-slate-100 h-24 animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-4">
            <Users className="h-7 w-7 text-indigo-400" />
          </div>
          <p className="font-medium text-slate-700">No pending requests</p>
          <p className="text-sm text-slate-400 mt-1">When a parent sends you a link request, it will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <RequestCard
              key={r.publicId}
              request={r}
              onApprove={(req) => setSelected({ request: req, action: 'approve' })}
              onReject={(req) => setSelected({ request: req, action: 'reject' })}
            />
          ))}
        </div>
      )}

      {selected && (
        <ConfirmModal
          request={selected.request}
          action={selected.action}
          onConfirm={handleConfirm}
          onClose={() => setSelected(null)}
          isPending={approving || rejecting}
        />
      )}
    </div>
  );
}
