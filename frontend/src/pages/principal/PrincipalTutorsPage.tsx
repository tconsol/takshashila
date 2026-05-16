import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Search } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import {
  usePendingTutors,
  useMyTutors,
  useTutorSearch,
  useApproveTutor,
  useSuspendTutor,
  useInviteTutor,
} from '../../hooks/use-tutors';
import {
  useIncomingJoinRequests,
  useOutgoingJoinRequests,
  useSendPrincipalRequest,
  useApproveJoinRequest,
  useRejectJoinRequest,
} from '../../hooks/use-join-requests';
import { joinRequestsService } from '../../services/join-requests.service';
import type { TutorSearchResult, JoinRequest } from '../../services/join-requests.service';
import type { TutorProfile } from '../../services/tutors.service';
import { useStartConversation } from '../../features/chat/use-chat';
import { useAuthStore } from '../../stores/auth.store';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

const statusVariant: Record<string, BadgeVariant> = {
  ACTIVE: 'success',
  UNDER_VERIFICATION: 'warning',
  REGISTERED: 'info',
  INVITED: 'default',
  SUSPENDED: 'danger',
  INACTIVE: 'default',
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  UNDER_VERIFICATION: 'Under Review',
  REGISTERED: 'Registered',
  INVITED: 'Invited',
  SUSPENDED: 'Suspended',
  INACTIVE: 'Inactive',
};

const REQ_STATUS_VARIANT: Record<string, BadgeVariant> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'default',
};

const TABS = [
  { key: 'all', label: 'All Tutors' },
  { key: 'pending', label: 'Pending Approval' },
  { key: 'requests', label: 'Join Requests' },
];

const ADMIN_TABS = [
  { key: 'all', label: 'All Tutors' },
  { key: 'pending', label: 'Pending Approval' },
];

export function PrincipalTutorsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isPrincipal = user?.role === 'PRINCIPAL';

  const [activeTab, setActiveTab] = useState('all');

  // Suspend flow
  const [suspendTarget, setSuspendTarget] = useState<TutorProfile | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

  // Invite flow
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ firstName: '', lastName: '', email: '', subjects: '' });

  // Add Tutor (principal sends request) flow
  const [showAddTutor, setShowAddTutor] = useState(false);
  const [addTutorQuery, setAddTutorQuery] = useState('');
  const [addTutorMessage, setAddTutorMessage] = useState('');
  // null = not searched yet, 'not-found' = searched but no result, TutorSearchResult = found
  const [searchResult, setSearchResult] = useState<TutorSearchResult | null | 'not-found'>(null);
  const [searching, setSearching] = useState(false);

  // Reject join request flow
  const [rejectTarget, setRejectTarget] = useState<JoinRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { mutateAsync: startConversation } = useStartConversation();
  const { mutateAsync: approve, isPending: approving } = useApproveTutor();
  const { mutateAsync: suspend, isPending: suspending } = useSuspendTutor();
  const { mutateAsync: invite, isPending: inviting, isSuccess: invited, reset: resetInvite } = useInviteTutor();
  const { mutateAsync: sendPrincipalRequest, isPending: sendingRequest, isSuccess: requestSent, reset: resetRequestSent } = useSendPrincipalRequest();
  const { mutateAsync: approveRequest, isPending: approvingRequest } = useApproveJoinRequest();
  const { mutateAsync: rejectRequest, isPending: rejectingRequest } = useRejectJoinRequest();

  const { data: pendingData, isLoading: pendingLoading } = usePendingTutors();
  const { data: myTutorsData, isLoading: myTutorsLoading } = useMyTutors(undefined);
  const { data: allTutorsData, isLoading: allTutorsLoading } = useTutorSearch(undefined);
  const { data: incomingRequests = [], isLoading: incomingLoading } = useIncomingJoinRequests();
  const { data: outgoingRequests = [], isLoading: outgoingLoading } = useOutgoingJoinRequests();

  const allData = isPrincipal ? myTutorsData : allTutorsData;
  const allLoading = isPrincipal ? myTutorsLoading : allTutorsLoading;

  const pendingList = pendingData?.items ?? [];
  const displayList = activeTab === 'pending' ? pendingList : (allData?.items ?? []);
  const isLoading = activeTab === 'pending' ? pendingLoading : allLoading;

  const handleMessage = async (tutor: TutorProfile) => {
    const conv = await startConversation({ recipientPublicId: tutor.userPublicId, recipientRole: 'TUTOR' });
    navigate(`/chat/${conv.publicId}`);
  };

  const handleSuspend = async () => {
    if (!suspendTarget) return;
    await suspend({ publicId: suspendTarget.publicId, reason: suspendReason });
    setSuspendTarget(null);
  };

  const handleInvite = async () => {
    await invite({
      email: inviteForm.email,
      firstName: inviteForm.firstName,
      lastName: inviteForm.lastName,
      subjects: inviteForm.subjects.split(',').map((s) => s.trim()).filter(Boolean),
    });
    setInviteForm({ firstName: '', lastName: '', email: '', subjects: '' });
  };

  const handleSearchTutor = async () => {
    if (!addTutorQuery.trim()) return;
    setSearching(true);
    try {
      const result = await joinRequestsService.searchTutor(addTutorQuery.trim());
      setSearchResult(result === null ? 'not-found' : result);
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async () => {
    if (!searchResult || searchResult === 'not-found') return;
    await sendPrincipalRequest({ query: addTutorQuery.trim(), message: addTutorMessage });
    setAddTutorQuery('');
    setAddTutorMessage('');
    setSearchResult(null);
  };

  const handleRejectRequest = async () => {
    if (!rejectTarget) return;
    await rejectRequest({ publicId: rejectTarget.publicId, reason: rejectReason });
    setRejectTarget(null);
    setRejectReason('');
  };

  const tabs = isPrincipal ? TABS : ADMIN_TABS;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tutors"
        subtitle={isPrincipal ? 'Invite and manage tutors in your institution' : 'Review and manage tutor accounts'}
        actions={
          isPrincipal ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowAddTutor(true); resetRequestSent(); setSearchResult(null); setAddTutorQuery(''); }}>
                <Search className="h-4 w-4 mr-1.5" /> Add Tutor
              </Button>
              <Button onClick={() => { setShowInvite(true); resetInvite(); }}>
                <UserPlus className="h-4 w-4 mr-1.5" /> Invite Tutor
              </Button>
            </div>
          ) : undefined
        }
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tutors List */}
      {activeTab !== 'requests' && (
        <>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : displayList.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              {activeTab === 'pending' ? 'No tutors pending approval' : 'No tutors found'}
            </div>
          ) : (
            <div className="space-y-3">
              {displayList.map((tutor) => (
                <TutorRow
                  key={tutor.publicId}
                  tutor={tutor}
                  statusVariant={statusVariant}
                  statusLabel={STATUS_LABEL}
                  onApprove={tutor.status === 'UNDER_VERIFICATION' ? () => approve(tutor.publicId) : undefined}
                  approvingId={approving ? tutor.publicId : null}
                  onSuspend={tutor.status === 'ACTIVE' ? () => { setSuspendTarget(tutor); setSuspendReason(''); } : undefined}
                  onMessage={() => handleMessage(tutor)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Join Requests Tab */}
      {activeTab === 'requests' && isPrincipal && (
        <div className="space-y-6">
          {/* Incoming from tutors */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Incoming Requests from Tutors
            </h3>
            {incomingLoading ? (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : incomingRequests.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">No incoming requests</div>
            ) : (
              <div className="space-y-3">
                {incomingRequests.map((req) => (
                  <JoinRequestRow
                    key={req.publicId}
                    request={req}
                    viewAs="principal-incoming"
                    reqStatusVariant={REQ_STATUS_VARIANT}
                    onApprove={() => approveRequest(req.publicId)}
                    approving={approvingRequest}
                    onReject={() => { setRejectTarget(req); setRejectReason(''); }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Outgoing to tutors */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Requests Sent to Tutors
            </h3>
            {outgoingLoading ? (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : outgoingRequests.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">No outgoing requests</div>
            ) : (
              <div className="space-y-3">
                {outgoingRequests.map((req) => (
                  <JoinRequestRow
                    key={req.publicId}
                    request={req}
                    viewAs="principal-outgoing"
                    reqStatusVariant={REQ_STATUS_VARIANT}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invite Tutor Modal */}
      <Modal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        title="Invite Tutor"
        size="sm"
        footer={
          invited ? (
            <Button onClick={() => setShowInvite(false)}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setShowInvite(false)}>Cancel</Button>
              <Button
                onClick={handleInvite}
                loading={inviting}
                disabled={!inviteForm.email || !inviteForm.firstName || !inviteForm.lastName}
              >
                Send Invite
              </Button>
            </>
          )
        }
      >
        {invited ? (
          <div className="text-center py-4 space-y-2">
            <div className="text-green-500 text-4xl">✓</div>
            <p className="font-semibold text-gray-900 dark:text-white">Invite sent!</p>
            <p className="text-sm text-gray-500">
              An invitation email has been sent to <strong>{inviteForm.email || 'the tutor'}</strong>.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First Name"
                value={inviteForm.firstName}
                onChange={(e) => setInviteForm((f) => ({ ...f, firstName: e.target.value }))}
                placeholder="Jane"
              />
              <Input
                label="Last Name"
                value={inviteForm.lastName}
                onChange={(e) => setInviteForm((f) => ({ ...f, lastName: e.target.value }))}
                placeholder="Doe"
              />
            </div>
            <Input
              label="Email"
              type="email"
              value={inviteForm.email}
              onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="tutor@example.com"
            />
            <Input
              label="Subjects (comma-separated)"
              value={inviteForm.subjects}
              onChange={(e) => setInviteForm((f) => ({ ...f, subjects: e.target.value }))}
              placeholder="Math, Physics, Chemistry"
            />
          </div>
        )}
      </Modal>

      {/* Add Tutor Modal */}
      <Modal
        open={showAddTutor}
        onClose={() => { setShowAddTutor(false); setSearchResult(null); setAddTutorQuery(''); }}
        title="Add Tutor by Email / Phone"
        size="sm"
        footer={
          requestSent ? (
            <Button onClick={() => { setShowAddTutor(false); resetRequestSent(); }}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => { setShowAddTutor(false); setSearchResult(null); setAddTutorQuery(''); }}>
                Cancel
              </Button>
              {searchResult && searchResult !== 'not-found' && (
                <Button onClick={handleSendRequest} loading={sendingRequest}>
                  Send Request
                </Button>
              )}
            </>
          )
        }
      >
        {requestSent ? (
          <div className="text-center py-4 space-y-2">
            <div className="text-green-500 text-4xl">✓</div>
            <p className="font-semibold text-gray-900 dark:text-white">Request sent!</p>
            <p className="text-sm text-gray-500">
              The tutor will receive a notification and can accept or decline your request.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Search for an existing tutor by their email address or phone number. They'll receive a request to join your institution.
            </p>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  label="Email or Phone"
                  value={addTutorQuery}
                  onChange={(e) => { setAddTutorQuery(e.target.value); setSearchResult(null); }}
                  placeholder="tutor@example.com or +91..."
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchTutor()}
                />
              </div>
              <div className="pt-6">
                <Button variant="outline" onClick={handleSearchTutor} loading={searching} disabled={!addTutorQuery.trim()}>
                  Search
                </Button>
              </div>
            </div>

            {searchResult && searchResult !== 'not-found' && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <Avatar name={searchResult.displayName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{searchResult.displayName}</p>
                    <p className="text-xs text-gray-400">{searchResult.email}</p>
                  </div>
                  <Badge variant={statusVariant[searchResult.status] ?? 'default'}>
                    {STATUS_LABEL[searchResult.status] ?? searchResult.status}
                  </Badge>
                </div>
                {searchResult.subjects.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {searchResult.subjects.slice(0, 4).map((s) => (
                      <span key={s} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded px-2 py-0.5">{s}</span>
                    ))}
                  </div>
                )}
                {searchResult.principalPublicId && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    This tutor is already attached to another institution.
                  </p>
                )}
              </div>
            )}

            {searchResult === 'not-found' && !searching && (
              <p className="text-sm text-red-500 text-center">No tutor found with that email or phone number.</p>
            )}

            {searchResult && searchResult !== 'not-found' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Message <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={addTutorMessage}
                  onChange={(e) => setAddTutorMessage(e.target.value)}
                  placeholder="Tell the tutor why you'd like them to join..."
                  className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Suspend Modal */}
      <Modal
        open={!!suspendTarget}
        onClose={() => setSuspendTarget(null)}
        title="Suspend Tutor"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSuspendTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleSuspend} loading={suspending} disabled={!suspendReason.trim()}>
              Suspend
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Suspending <strong>{suspendTarget?.displayName}</strong> will prevent them from accepting new bookings.
          </p>
          <Input
            label="Reason"
            placeholder="Reason for suspension…"
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
          />
        </div>
      </Modal>

      {/* Reject Join Request Modal */}
      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Reject Join Request"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleRejectRequest} loading={rejectingRequest}>Reject</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Rejecting the request from <strong>{rejectTarget?.tutorName}</strong>.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Reason <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Let the tutor know why..."
              className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function TutorRow({
  tutor,
  statusVariant,
  statusLabel,
  onApprove,
  approvingId,
  onSuspend,
  onMessage,
}: {
  tutor: TutorProfile;
  statusVariant: Record<string, BadgeVariant>;
  statusLabel: Record<string, string>;
  onApprove?: () => void;
  approvingId?: string | null;
  onSuspend?: () => void;
  onMessage?: () => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4">
      <Avatar name={tutor.displayName} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-gray-900 dark:text-white">{tutor.displayName}</p>
          <Badge variant={statusVariant[tutor.status] ?? 'default'}>
            {statusLabel[tutor.status] ?? tutor.status}
          </Badge>
          {tutor.isVerified && <Badge variant="success">Verified</Badge>}
        </div>
        {tutor.email && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{tutor.email}</p>
        )}
        {tutor.subjects && tutor.subjects.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {tutor.subjects.slice(0, 4).map((s) => (
              <span key={s} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded px-2 py-0.5">{s}</span>
            ))}
          </div>
        )}
        <div className="flex gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span>★ {tutor.rating?.toFixed(1) ?? '0.0'}</span>
          <span>{tutor.totalStudents} students</span>
          <span>{tutor.totalClassesCompleted} classes</span>
        </div>
      </div>
      <div className="flex gap-2">
        {onMessage && tutor.status !== 'INVITED' && (
          <Button size="sm" variant="outline" onClick={onMessage}>Message</Button>
        )}
        {onApprove && (
          <Button size="sm" onClick={onApprove} loading={approvingId === tutor.publicId}>
            Approve
          </Button>
        )}
        {onSuspend && (
          <Button size="sm" variant="danger" onClick={onSuspend}>Suspend</Button>
        )}
      </div>
    </div>
  );
}

function JoinRequestRow({
  request,
  viewAs,
  reqStatusVariant,
  onApprove,
  approving,
  onReject,
}: {
  request: JoinRequest;
  viewAs: 'principal-incoming' | 'principal-outgoing';
  reqStatusVariant: Record<string, BadgeVariant>;
  onApprove?: () => void;
  approving?: boolean;
  onReject?: () => void;
}) {
  const name = request.tutorName;
  const email = request.tutorEmail;
  const subjects = request.tutorSubjects;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4">
      <Avatar name={name} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-gray-900 dark:text-white">{name}</p>
          <Badge variant={reqStatusVariant[request.status] ?? 'default'}>{request.status}</Badge>
        </div>
        {email && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{email}</p>}
        {subjects.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {subjects.slice(0, 4).map((s) => (
              <span key={s} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded px-2 py-0.5">{s}</span>
            ))}
          </div>
        )}
        {request.message && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">"{request.message}"</p>
        )}
      </div>
      {viewAs === 'principal-incoming' && request.status === 'PENDING' && (
        <div className="flex gap-2 flex-shrink-0">
          <Button size="sm" onClick={onApprove} loading={approving}>Approve</Button>
          <Button size="sm" variant="danger" onClick={onReject}>Reject</Button>
        </div>
      )}
    </div>
  );
}
