import { formatInTimeZone } from 'date-fns-tz';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../ui/Badge';
import type { ClassRecord } from '../../services/classes.service';
import type { SessionStudent } from '../../utils/class-groups';
import { useAuthStore } from '../../stores/auth.store';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

const statusColors: Record<string, BadgeVariant> = {
  SCHEDULED: 'info',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  INCOMPLETE: 'warning',
  NO_SHOW: 'default',
};

const classTypeColors: Record<string, BadgeVariant> = {
  DEMO: 'warning',
  REGULAR: 'info',
  INTENSIVE: 'success',
};

const FIFTEEN_MIN_MS = 15 * 60 * 1000;

interface ClassCardProps {
  cls: ClassRecord;
  perspective: 'tutor' | 'student' | 'principal';
  onAction?: (action: 'start' | 'complete' | 'cancel' | 'join' | 'rate' | 'accept' | 'decline', cls: ClassRecord) => void;
  ratedClassIds?: Set<string>;
  /** For a tutor's group row: each student and whether they accepted. */
  students?: SessionStudent[];
}

const REQUEST_LABEL: Record<string, { text: string; variant: BadgeVariant }> = {
  PENDING: { text: 'Pending', variant: 'warning' },
  ACCEPTED: { text: 'Accepted', variant: 'success' },
  DECLINED: { text: 'Declined', variant: 'danger' },
  EXPIRED: { text: 'Expired', variant: 'default' },
};

export function ClassCard({ cls, perspective, onAction, ratedClassIds, students }: ClassCardProps) {
  const userTimezone =
    useAuthStore((s) => s.user?.timezone) ??
    Intl.DateTimeFormat().resolvedOptions().timeZone;
  const navigate = useNavigate();

  const start = cls.scheduledStartUTC ? new Date(cls.scheduledStartUTC) : null;
  const end   = cls.scheduledEndUTC   ? new Date(cls.scheduledEndUTC)   : null;
  const now   = Date.now();

  const isInProgress = cls.status === 'IN_PROGRESS' || cls.status === 'LIVE';
  // Join window: within 15 min before start OR already in progress/live
  // A tutor-created class nobody has accepted yet has no room to join.
  const awaitingStudent = cls.requestStatus === 'PENDING';
  const canJoin = awaitingStudent ? false : start
    ? isInProgress || ((cls.status === 'SCHEDULED') && now >= start.getTime() - FIFTEEN_MIN_MS)
    : false;
  // What one session costs this student: price plus the platform fee, taken only when the session completes.
  const perSessionCredits = cls.costCents > 0 ? (cls.costCents + 100) / 100 : 0;

  const minutesUntilStart = start ? Math.ceil((start.getTime() - now) / 60_000) : null;

  // Classes with an external Google Meet / Zoom link open in a new tab; others
  // use the native in-app room.
  const externalUrl = cls.meetingProvider && cls.meetingProvider !== 'native' ? cls.meetingUrl : undefined;

  function handleJoin() {
    if (externalUrl) {
      window.open(externalUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(`/class/${cls.publicId}`);
  }

  const tzAbbr = formatInTimeZone(new Date(), userTimezone, 'zzz');

  // Each side needs to see who the class is *with* — a tutor's list is useless
  // without the student's name, and vice versa.
  const counterparty =
    perspective === 'tutor'   ? cls.studentName
    : perspective === 'student' ? (cls.tutorName ? `with ${cls.tutorName}` : undefined)
    : [cls.tutorName, cls.studentName].filter(Boolean).join(' → ') || undefined;

  return (
    <div className="flex flex-col gap-3 rounded border border-rule bg-surface p-5 transition-colors hover:bg-surface-hover">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{cls.subject}</p>
          {counterparty && (
            <p className="mt-0.5 text-sm font-medium text-ink-2">{counterparty}</p>
          )}
          {perspective === 'tutor' && students && students.some((s) => s.requestStatus) && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {students.map((s, i) => {
                const label = s.requestStatus ? REQUEST_LABEL[s.requestStatus] : undefined;
                return label ? (
                  <Badge key={i} variant={label.variant} tone="outline" title={`${s.name || 'Student'}: ${label.text.toLowerCase()}`}>
                    {(s.name || 'Student')} · {label.text}
                  </Badge>
                ) : null;
              })}
            </div>
          )}
          <p className="mt-0.5 text-sm text-ink-muted">
            {start
              ? `${formatInTimeZone(start, userTimezone, 'EEE, MMM d yyyy')} · ${formatInTimeZone(start, userTimezone, 'h:mm a')}${end ? ` – ${formatInTimeZone(end, userTimezone, 'h:mm a')}` : ''} ${tzAbbr}`
              : 'Time TBD'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge variant={statusColors[cls.status] ?? 'default'}>{cls.status.replace('_', ' ')}</Badge>
          <Badge variant={classTypeColors[cls.classType] ?? 'default'}>{cls.classType}</Badge>
          {awaitingStudent && cls.status === 'SCHEDULED' && (
            <Badge variant="warning" tone="outline" title="The student has to accept before this class can run">
              {perspective === 'student' ? 'Awaiting your answer' : 'Awaiting student'}
            </Badge>
          )}
          {cls.status === 'INCOMPLETE' && (
            <Badge variant="warning" tone="outline" title="No credits were charged or paid">
              {perspective === 'student' ? 'Not charged' : 'Not paid'}
            </Badge>
          )}
          {cls.studentLeftEarly && perspective !== 'student' && (
            <Badge variant="info" tone="outline" title="The student attended less than the required share; the class was still billed">
              Student left early
            </Badge>
          )}
          {cls.studentLeftEarly && perspective === 'student' && (
            <Badge variant="info" tone="outline" title="You attended less than the required share, so the class was still charged">
              You left early
            </Badge>
          )}
          {cls.autoResolution && (
            <Badge
              variant={cls.autoResolution === 'AUTO_COMPLETED' ? 'info' : 'warning'}
              tone="outline"
              title="Closed automatically because it was left open past its end time"
            >
              {cls.autoResolution === 'AUTO_COMPLETED' ? 'Auto completed' : 'Auto cancelled'}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-muted">
          {cls.costCents === 0 ? 'Free Demo' : (cls.costCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
        </span>
        {(cls.status === 'SCHEDULED' || isInProgress) && !canJoin && minutesUntilStart !== null && minutesUntilStart > 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Opens in {minutesUntilStart < 60 ? `${minutesUntilStart}m` : `${Math.ceil(minutesUntilStart / 60)}h`}
          </span>
        )}
      </div>

      {onAction && perspective === 'student' && cls.status === 'COMPLETED' && !cls.isRefunded && !ratedClassIds?.has(cls.publicId) && (
        <div className="flex gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={() => onAction('rate', cls)}
            className="flex-1 text-sm font-medium text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg py-1.5 transition-colors"
          >
            Rate Class
          </button>
        </div>
      )}

      {onAction && perspective === 'student' && awaitingStudent && cls.status === 'SCHEDULED' && (
        <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-ink-muted">
            {perSessionCredits > 0
              ? `${perSessionCredits.toLocaleString('en-US', { maximumFractionDigits: 2 })} credits per session (price plus 1 credit platform fee), charged only after the session is completed.`
              : 'Free session.'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onAction('accept', cls)}
              className="flex-1 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg py-1.5 transition-colors"
            >
              Accept
            </button>
            <button
              onClick={() => onAction('decline', cls)}
              className="flex-1 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg py-1.5 transition-colors"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {(cls.status === 'SCHEDULED' || isInProgress) && !(perspective === 'student' && awaitingStudent) && (
        <div className="flex gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
          {/* Join button both tutor and student */}
          {canJoin ? (
            <button
              onClick={handleJoin}
              className="flex-1 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg py-1.5 transition-colors"
            >
              {externalUrl
                ? `Join on ${cls.meetingProvider === 'zoom' ? 'Zoom' : 'Google Meet'} ↗`
                : isInProgress ? 'Join Now' : 'Join Class'}
            </button>
          ) : (
            <button
              disabled
              className="flex-1 text-sm font-medium text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 rounded-lg py-1.5 cursor-not-allowed"
              title={awaitingStudent ? 'Waiting for the student to accept' : 'Available 15 minutes before class starts'}
            >
              {awaitingStudent ? 'Waiting for student' : 'Join Class'}
            </button>
          )}

          {onAction && (
            <>
              {perspective === 'tutor' && isInProgress && (
                <button
                  onClick={() => onAction('complete', cls)}
                  className="flex-1 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg py-1.5 transition-colors"
                >
                  Complete
                </button>
              )}
              <button
                onClick={() => onAction('cancel', cls)}
                className="flex-1 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg py-1.5 transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
