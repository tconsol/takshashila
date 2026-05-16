import { useState } from 'react';
import { Building2, Users, GraduationCap, Send, X, Clock, CheckCircle, XCircle, Globe, Mail } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { Avatar } from '../../components/ui/Avatar';
import {
  useActivePrincipals,
  useIncomingJoinRequests,
  useOutgoingJoinRequests,
  useSendTutorRequest,
  useApproveJoinRequest,
  useRejectJoinRequest,
  useCancelJoinRequest,
} from '../../hooks/use-join-requests';
import { useMyPrincipal } from '../../hooks/use-tutors';
import type { ActivePrincipal, JoinRequest } from '../../services/join-requests.service';
import type { MyPrincipal } from '../../services/tutors.service';

const TABS = [
  { key: 'mine', label: 'My Principals' },
  { key: 'browse', label: 'Find a Principal' },
  { key: 'incoming', label: 'Requests Received' },
  { key: 'outgoing', label: 'My Requests' },
];

type StatusBadge = 'default' | 'success' | 'warning' | 'danger' | 'info';
const statusVariant: Record<string, StatusBadge> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'default',
};

export function TutorPrincipalsPage() {
  const [activeTab, setActiveTab] = useState('mine');
  const [selectedPrincipal, setSelectedPrincipal] = useState<ActivePrincipal | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [rejectTarget, setRejectTarget] = useState<JoinRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: myPrincipal, isLoading: myPrincipalLoading } = useMyPrincipal();
  const { data: principalsData, isLoading: principalsLoading } = useActivePrincipals();
  const { data: incoming = [], isLoading: incomingLoading } = useIncomingJoinRequests();
  const { data: outgoing = [], isLoading: outgoingLoading } = useOutgoingJoinRequests();

  const { mutateAsync: sendRequest, isPending: sending } = useSendTutorRequest();
  const { mutateAsync: approve, isPending: approving } = useApproveJoinRequest();
  const { mutateAsync: reject, isPending: rejecting } = useRejectJoinRequest();
  const { mutateAsync: cancel } = useCancelJoinRequest();

  // Build a map of principal → outgoing request status for quick lookup
  const outgoingMap = new Map(outgoing.map((r) => [r.principalProfilePublicId, r]));

  const handleSendRequest = async () => {
    if (!selectedPrincipal) return;
    await sendRequest({ principalProfilePublicId: selectedPrincipal.publicId, message: requestMessage });
    setSelectedPrincipal(null);
    setRequestMessage('');
  };

  const handleApprove = async (req: JoinRequest) => {
    await approve(req.publicId);
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    await reject({ publicId: rejectTarget.publicId, reason: rejectReason });
    setRejectTarget(null);
    setRejectReason('');
  };

  const principals = principalsData?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Principals"
        subtitle="Find a principal to join their institution or manage your join requests"
        icon={<Building2 className="h-5 w-5" />}
      />

      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {/* My Principals */}
      {activeTab === 'mine' && (
        <>
          {myPrincipalLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !myPrincipal ? (
            <div className="text-center py-16 space-y-3">
              <Building2 className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">You're not linked to any principal yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Browse principals and send a join request, or wait for a principal to invite you.
              </p>
              <Button size="sm" variant="outline" onClick={() => setActiveTab('browse')}>
                <Send className="h-4 w-4 mr-1.5" /> Find a Principal
              </Button>
            </div>
          ) : (
            <MyPrincipalCard principal={myPrincipal} />
          )}
        </>
      )}

      {/* Browse Principals */}
      {activeTab === 'browse' && (
        <>
          {principalsLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : principals.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No active principals found</div>
          ) : (
            <div className="space-y-3">
              {principals.map((p) => {
                const existing = outgoingMap.get(p.publicId);
                const isJoined = !!myPrincipal && myPrincipal.userPublicId === p.userPublicId;
                return (
                  <PrincipalCard
                    key={p.publicId}
                    principal={p}
                    existingRequest={existing}
                    isJoined={isJoined}
                    onRequest={() => { setSelectedPrincipal(p); setRequestMessage(''); }}
                    onCancel={existing && existing.status === 'PENDING' ? () => cancel(existing.publicId) : undefined}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Incoming requests from principals */}
      {activeTab === 'incoming' && (
        <>
          {incomingLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : incoming.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No incoming requests from principals</div>
          ) : (
            <div className="space-y-3">
              {incoming.map((req) => (
                <RequestRow
                  key={req.publicId}
                  request={req}
                  viewAs="tutor"
                  statusVariant={statusVariant}
                  onApprove={() => handleApprove(req)}
                  approving={approving}
                  onReject={() => { setRejectTarget(req); setRejectReason(''); }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* My outgoing requests */}
      {activeTab === 'outgoing' && (
        <>
          {outgoingLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : outgoing.length === 0 ? (
            <div className="text-center py-12 text-gray-400">You haven't sent any join requests yet</div>
          ) : (
            <div className="space-y-3">
              {outgoing.map((req) => (
                <RequestRow
                  key={req.publicId}
                  request={req}
                  viewAs="tutor-outgoing"
                  statusVariant={statusVariant}
                  onCancel={req.status === 'PENDING' ? () => cancel(req.publicId) : undefined}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Send Request Modal */}
      <Modal
        open={!!selectedPrincipal}
        onClose={() => setSelectedPrincipal(null)}
        title="Request to Join Principal"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSelectedPrincipal(null)}>Cancel</Button>
            <Button onClick={handleSendRequest} loading={sending}>
              <Send className="h-4 w-4 mr-1.5" /> Send Request
            </Button>
          </>
        }
      >
        {selectedPrincipal && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
              <Avatar name={selectedPrincipal.organizationName ?? `${selectedPrincipal.firstName} ${selectedPrincipal.lastName}`} size="md" />
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {selectedPrincipal.organizationName || `${selectedPrincipal.firstName} ${selectedPrincipal.lastName}`}
                </p>
                <p className="text-xs text-gray-500">{selectedPrincipal.email}</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Message <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                rows={3}
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="Introduce yourself and explain why you want to join..."
                className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Decline Request"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleReject} loading={rejecting}>Decline</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Declining the request from <strong>{rejectTarget?.principalOrg || rejectTarget?.principalName}</strong>.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Reason <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Let the principal know why you're declining..."
              className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

const PRINCIPAL_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  PENDING_APPROVAL: 'Pending Approval',
  SUSPENDED: 'Suspended',
  INACTIVE: 'Inactive',
};

const PRINCIPAL_STATUS_VARIANT: Record<string, StatusBadge> = {
  ACTIVE: 'success',
  PENDING_APPROVAL: 'warning',
  SUSPENDED: 'danger',
  INACTIVE: 'default',
};

function MyPrincipalCard({ principal }: { principal: MyPrincipal }) {
  const displayName = principal.organizationName || `${principal.firstName} ${principal.lastName}`;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
      <div className="flex items-start gap-4">
        <Avatar name={displayName} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{displayName}</h3>
            <Badge variant={PRINCIPAL_STATUS_VARIANT[principal.status] ?? 'default'}>
              {PRINCIPAL_STATUS_LABEL[principal.status] ?? principal.status}
            </Badge>
          </div>
          {principal.organizationName && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {principal.firstName} {principal.lastName}
            </p>
          )}
          <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> {principal.email}
            </span>
            {principal.organizationWebsite && (
              <a
                href={principal.organizationWebsite}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-brand-600 dark:text-brand-400 hover:underline"
              >
                <Globe className="h-3.5 w-3.5" /> {principal.organizationWebsite}
              </a>
            )}
          </div>
        </div>
      </div>

      {principal.bio && (
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{principal.bio}</p>
      )}

      <div className="flex gap-6 pt-2 border-t border-gray-100 dark:border-gray-700">
        <div className="text-center">
          <p className="text-xl font-bold text-gray-900 dark:text-white">{principal.totalTutors}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Tutors</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-gray-900 dark:text-white">{principal.totalStudents}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Students</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-gray-900 dark:text-white">{principal.commissionRatePercent}%</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Commission</p>
        </div>
      </div>
    </div>
  );
}

function PrincipalCard({
  principal,
  existingRequest,
  isJoined,
  onRequest,
  onCancel,
}: {
  principal: ActivePrincipal;
  existingRequest?: JoinRequest;
  isJoined?: boolean;
  onRequest: () => void;
  onCancel?: () => void;
}) {
  const displayName = principal.organizationName || `${principal.firstName} ${principal.lastName}`;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border p-4 flex items-center gap-4 ${isJoined ? 'border-green-300 dark:border-green-700 bg-green-50/30 dark:bg-green-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
      <Avatar name={displayName} size="md" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 dark:text-white">{displayName}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{principal.email}</p>
        {principal.bio && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{principal.bio}</p>
        )}
        <div className="flex gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1"><GraduationCap className="h-3 w-3" /> {principal.totalTutors} tutors</span>
          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {principal.totalStudents} students</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {isJoined ? (
          <Badge variant="success">
            <CheckCircle className="h-3 w-3 mr-1" /> Joined
          </Badge>
        ) : existingRequest ? (
          <>
            <Badge variant={existingRequest.status === 'PENDING' ? 'warning' : existingRequest.status === 'APPROVED' ? 'success' : 'danger'}>
              {existingRequest.status === 'PENDING' && <Clock className="h-3 w-3 mr-1" />}
              {existingRequest.status === 'APPROVED' && <CheckCircle className="h-3 w-3 mr-1" />}
              {existingRequest.status === 'REJECTED' && <XCircle className="h-3 w-3 mr-1" />}
              {existingRequest.status}
            </Badge>
            {onCancel && (
              <Button size="sm" variant="ghost" onClick={onCancel}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </>
        ) : (
          <Button size="sm" onClick={onRequest}>
            <Send className="h-4 w-4 mr-1.5" /> Request to Join
          </Button>
        )}
      </div>
    </div>
  );
}

function RequestRow({
  request,
  viewAs,
  statusVariant,
  onApprove,
  approving,
  onReject,
  onCancel,
}: {
  request: JoinRequest;
  viewAs: 'tutor' | 'tutor-outgoing';
  statusVariant: Record<string, StatusBadge>;
  onApprove?: () => void;
  approving?: boolean;
  onReject?: () => void;
  onCancel?: () => void;
}) {
  const isPrincipalSide = viewAs === 'tutor'; // showing principal info
  const name = isPrincipalSide
    ? (request.principalOrg || request.principalName)
    : (request.principalOrg || request.principalName);
  const email = isPrincipalSide ? request.principalEmail : request.principalEmail;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4">
      <Avatar name={name} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-gray-900 dark:text-white">{name}</p>
          <Badge variant={statusVariant[request.status] ?? 'default'}>{request.status}</Badge>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{email}</p>
        {request.message && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">"{request.message}"</p>
        )}
        {request.rejectionReason && (
          <p className="text-xs text-red-500 mt-1">Reason: {request.rejectionReason}</p>
        )}
      </div>
      <div className="flex gap-2 flex-shrink-0">
        {onApprove && request.status === 'PENDING' && (
          <Button size="sm" onClick={onApprove} loading={approving}>Accept</Button>
        )}
        {onReject && request.status === 'PENDING' && (
          <Button size="sm" variant="danger" onClick={onReject}>Decline</Button>
        )}
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        )}
      </div>
    </div>
  );
}
