import { useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { Sparkles, Clock, Check, X, ChevronDown, ChevronUp, Inbox, CalendarDays, MessageSquare } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { Tabs } from '../../components/ui/Tabs';
import {
  useDemoRequestsAsTutor,
  useAcceptDemoRequest,
  useRejectDemoRequest,
} from '../../hooks/use-demo-requests';
import type { DemoRequest } from '../../services/demo-requests.service';

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'REJECTED', label: 'Rejected' },
];

function RejectInline({
  onConfirm,
  onCancel,
  isPending,
}: {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800/40 p-3 space-y-2">
      <p className="text-xs font-medium text-red-700 dark:text-red-300">Reason for rejection</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder="e.g. Slot already taken, schedule conflict…"
        className="w-full rounded-lg border border-red-200 bg-white dark:bg-gray-900 dark:border-red-800 px-3 py-2 text-sm text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-1 focus:ring-red-400"
      />
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => reason.trim() && onConfirm(reason.trim())}
          loading={isPending}
          disabled={!reason.trim()}
        >
          Confirm reject
        </Button>
      </div>
    </div>
  );
}

function RequestRow({ request, timezone }: { request: DemoRequest; timezone: string }) {
  const [showReject, setShowReject] = useState(false);
  const { mutate: accept, isPending: accepting } = useAcceptDemoRequest();
  const { mutate: reject, isPending: rejecting } = useRejectDemoRequest();

  const slotLabel =
    request.slotStartUTC && request.slotEndUTC
      ? `${formatInTimeZone(new Date(request.slotStartUTC), timezone, 'EEE, MMM d · h:mm a')} – ${formatInTimeZone(new Date(request.slotEndUTC), timezone, 'h:mm a zzz')}`
      : 'Slot time unavailable';

  const statusBadge = {
    PENDING: <Badge variant="warning" tone="soft">Pending</Badge>,
    ACCEPTED: <Badge variant="success" tone="soft">Accepted</Badge>,
    REJECTED: <Badge variant="danger" tone="soft">Rejected</Badge>,
  }[request.status];

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:border-brand-200 dark:hover:border-brand-800/60 transition-colors">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {/* Left */}
        <div className="flex items-start gap-4 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/40">
            <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {request.preferredSubject}
              </p>
              {statusBadge}
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
              <Clock className="h-3 w-3 shrink-0" />
              {slotLabel}
            </p>
            {request.message && (
              <div className="mt-2 flex items-start gap-1.5">
                <MessageSquare className="h-3 w-3 shrink-0 mt-0.5 text-gray-400" />
                <p className="text-xs text-gray-500 italic">"{request.message}"</p>
              </div>
            )}
            {request.status === 'REJECTED' && request.rejectionReason && (
              <p className="mt-1.5 text-xs text-red-500">Reason: {request.rejectionReason}</p>
            )}
            <p className="mt-2 text-[11px] text-gray-400">
              Received {formatInTimeZone(new Date(request.createdAt), timezone, 'MMM d, yyyy · h:mm a')}
            </p>
          </div>
        </div>

        {/* Actions (PENDING only) */}
        {request.status === 'PENDING' && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="gradient"
              onClick={() => accept(request.publicId)}
              loading={accepting}
              disabled={accepting || rejecting}
            >
              <Check className="h-3.5 w-3.5" /> Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="!border-red-300 !text-red-600 hover:!bg-red-50 dark:!border-red-700 dark:!text-red-400 dark:hover:!bg-red-900/20"
              onClick={() => setShowReject((v) => !v)}
              disabled={accepting || rejecting}
            >
              <X className="h-3.5 w-3.5" />
              Reject
              {showReject ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </div>
        )}
        {request.status === 'ACCEPTED' && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <CalendarDays className="h-3.5 w-3.5" />
            Class scheduled
          </div>
        )}
      </div>

      {showReject && request.status === 'PENDING' && (
        <RejectInline
          onConfirm={(reason) => {
            reject({ requestId: request.publicId, reason });
            setShowReject(false);
          }}
          onCancel={() => setShowReject(false)}
          isPending={rejecting}
        />
      )}
    </div>
  );
}

export function TutorDemoRequestsPage() {
  const [activeTab, setActiveTab] = useState('');
  const userTimezone =
    useAuthStore((s) => s.user?.timezone) ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  const statusParam = activeTab === '' ? undefined : activeTab;
  const { data, isLoading } = useDemoRequestsAsTutor(
    statusParam ? { status: statusParam, limit: '50' } : { limit: '50' },
  );

  const requests = data?.items ?? [];

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Tutor Studio"
        title="Demo Requests"
        description="Review and manage free demo requests from students."
        icon={<Sparkles className="h-5 w-5" />}
      />

      <Tabs
        tabs={STATUS_TABS.map((t) => ({ key: t.key, label: t.label }))}
        activeTab={activeTab}
        onChange={setActiveTab}
        className="mb-5"
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-14 text-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
                <Inbox className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {activeTab === 'PENDING'
                  ? 'No pending demo requests'
                  : activeTab === 'ACCEPTED'
                  ? 'No accepted requests yet'
                  : activeTab === 'REJECTED'
                  ? 'No rejected requests'
                  : 'No demo requests yet'}
              </p>
              <p className="text-xs text-gray-500 max-w-xs">
                {activeTab === 'PENDING'
                  ? 'When students send demo requests, they will appear here for you to review.'
                  : 'Requests that have been processed will appear here.'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <RequestRow key={req.publicId} request={req} timezone={userTimezone} />
          ))}
          {data && data.total > requests.length && (
            <p className="text-center text-xs text-gray-400 pt-2">
              Showing {requests.length} of {data.total} requests
            </p>
          )}
        </div>
      )}
    </div>
  );
}
