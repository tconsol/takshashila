import { format } from 'date-fns';
import { Badge } from '../ui/Badge';
import type { ClassRecord } from '../../services/classes.service';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

const statusColors: Record<string, BadgeVariant> = {
  SCHEDULED: 'info',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  NO_SHOW: 'default',
};

const classTypeColors: Record<string, BadgeVariant> = {
  DEMO: 'warning',
  REGULAR: 'info',
  INTENSIVE: 'success',
};

interface ClassCardProps {
  cls: ClassRecord;
  perspective: 'tutor' | 'student';
  onAction?: (action: 'start' | 'complete' | 'cancel' | 'join' | 'rate', cls: ClassRecord) => void;
  ratedClassIds?: Set<string>;
}

export function ClassCard({ cls, perspective, onAction, ratedClassIds }: ClassCardProps) {
  const start = cls.scheduledStartUTC ? new Date(cls.scheduledStartUTC) : null;
  const end = cls.scheduledEndUTC ? new Date(cls.scheduledEndUTC) : null;
  const now = new Date();
  const isUpcoming = start ? start > now : false;
  const isInProgress = cls.status === 'IN_PROGRESS';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">{cls.subject}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {start ? `${format(start, 'EEE, MMM d yyyy')} · ${format(start, 'h:mm a')}${end ? ` – ${format(end, 'h:mm a')}` : ''}` : 'Time TBD'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge variant={statusColors[cls.status] ?? 'default'}>{cls.status.replace('_', ' ')}</Badge>
          <Badge variant={classTypeColors[cls.classType] ?? 'default'}>{cls.classType}</Badge>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500 dark:text-gray-400">
          {(cls.costCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
        </span>
        {cls.meetingUrl && (isUpcoming || isInProgress) && (
          <a
            href={cls.meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium text-xs"
          >
            Join Meeting →
          </a>
        )}
      </div>

      {onAction && perspective === 'student' && cls.status === 'COMPLETED' && !ratedClassIds?.has(cls.publicId) && (
        <div className="flex gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={() => onAction('rate', cls)}
            className="flex-1 text-sm font-medium text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg py-1.5 transition-colors"
          >
            Rate Class
          </button>
        </div>
      )}

      {onAction && cls.status !== 'CANCELLED' && cls.status !== 'COMPLETED' && (
        <div className="flex gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
          {perspective === 'tutor' && cls.status === 'SCHEDULED' && (
            <button
              onClick={() => onAction('start', cls)}
              className="flex-1 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg py-1.5 transition-colors"
            >
              Start
            </button>
          )}
          {perspective === 'tutor' && isInProgress && (
            <button
              onClick={() => onAction('complete', cls)}
              className="flex-1 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg py-1.5 transition-colors"
            >
              Complete
            </button>
          )}
          {perspective === 'student' && isInProgress && cls.meetingUrl && (
            <button
              onClick={() => onAction('join', cls)}
              className="flex-1 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg py-1.5 transition-colors"
            >
              Join Now
            </button>
          )}
          <button
            onClick={() => onAction('cancel', cls)}
            className="flex-1 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg py-1.5 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
