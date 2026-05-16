import { Sparkles, ArrowUpRight, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatInTimeZone } from 'date-fns-tz';
import { useAuthStore } from '../../stores/auth.store';
import { useDemoRequestsAsTutor, useAcceptDemoRequest, useRejectDemoRequest } from '../../hooks/use-demo-requests';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type { DemoRequest } from '../../services/demo-requests.service';
import { useState } from 'react';

function QuickRejectForm({
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
    <div className="mt-2 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800/40 p-3 space-y-2">
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder="Reason for rejection…"
        className="w-full rounded-lg border border-red-200 bg-white dark:bg-gray-900 dark:border-red-800 px-3 py-1.5 text-xs text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-1 focus:ring-red-400"
      />
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={isPending}>Cancel</Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => reason.trim() && onConfirm(reason.trim())}
          loading={isPending}
          disabled={!reason.trim()}
        >
          Reject
        </Button>
      </div>
    </div>
  );
}

function MiniRequestRow({ request, timezone }: { request: DemoRequest; timezone: string }) {
  const [showReject, setShowReject] = useState(false);
  const { mutate: accept, isPending: accepting } = useAcceptDemoRequest();
  const { mutate: reject, isPending: rejecting } = useRejectDemoRequest();

  const slotLabel = request.slotStartUTC
    ? formatInTimeZone(new Date(request.slotStartUTC), timezone, 'EEE, MMM d · h:mm a')
    : '—';

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-amber-100 dark:border-amber-900/30 last:border-0 flex-wrap">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {request.preferredSubject}
          </span>
          <Badge variant="warning" tone="soft" className="text-[10px] shrink-0">Demo</Badge>
        </div>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
          <Clock className="h-3 w-3 shrink-0" />
          {slotLabel}
        </p>
        {showReject && (
          <QuickRejectForm
            onConfirm={(reason) => {
              reject({ requestId: request.publicId, reason });
              setShowReject(false);
            }}
            onCancel={() => setShowReject(false)}
            isPending={rejecting}
          />
        )}
      </div>
      {!showReject && (
        <div className="flex gap-1.5 shrink-0">
          <Button
            size="sm"
            variant="gradient"
            onClick={() => accept(request.publicId)}
            loading={accepting}
            disabled={accepting || rejecting}
          >
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="!border-red-300 !text-red-500 hover:!bg-red-50 dark:!border-red-700 dark:!text-red-400"
            onClick={() => setShowReject(true)}
            disabled={accepting || rejecting}
          >
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}

export function DemoRequestsSection() {
  const userTimezone =
    useAuthStore((s) => s.user?.timezone) ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data, isLoading } = useDemoRequestsAsTutor({ status: 'PENDING', limit: '3' });
  const pendingRequests = data?.items ?? [];
  const total = data?.total ?? 0;

  if (!isLoading && pendingRequests.length === 0) return null;

  return (
    <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-900/10 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-amber-200/60 dark:border-amber-800/30">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
            <Sparkles className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">Demo Requests</span>
          {total > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
              {total}
            </span>
          )}
        </div>
        <Link
          to="/dashboard/tutor/demo-requests"
          className="flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
        >
          View all <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Request rows */}
      <div className="px-4">
        {isLoading ? (
          <p className="py-4 text-xs text-center text-gray-500">Loading…</p>
        ) : (
          pendingRequests.map((req) => (
            <MiniRequestRow key={req.publicId} request={req} timezone={userTimezone} />
          ))
        )}
      </div>
    </div>
  );
}
