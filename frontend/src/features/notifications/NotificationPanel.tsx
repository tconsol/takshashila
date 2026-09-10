import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useNotifications, useMarkRead, useMarkAllRead, useDeleteNotification } from './use-notifications';
import { notificationLink } from './notification-routes';
import { Spinner } from '../../components/ui/Loading';
import { useAuthStore } from '../../stores/auth.store';
import type { INotification } from './notification.types';

interface Props {
  onClose: () => void;
}

export function NotificationPanel({ onClose }: Props) {
  const { data, isLoading } = useNotifications();
  const { mutate: markRead } = useMarkRead();
  const { mutate: markAllRead } = useMarkAllRead();
  const { mutate: deleteNotif } = useDeleteNotification();
  const role = useAuthStore((s) => s.user?.role);
  const navigate = useNavigate();

  const open = (notif: INotification) => {
    if (!notif.isRead) markRead(notif.publicId);
    const link = notificationLink(notif, role);
    if (link) {
      navigate(link);
      onClose();
    }
  };

  return (
    <div className="absolute right-0 top-10 z-50 w-96 overflow-hidden rounded-xl border border-rule-strong bg-surface shadow-pop">
      <div className="flex items-center justify-between border-b border-rule px-4 py-3">
        <span className="font-semibold text-ink">Notifications</span>
        <div className="flex items-center gap-3">
          <button onClick={() => markAllRead()} className="text-xs text-accent hover:underline">
            Mark all read
          </button>
          <button onClick={onClose} className="text-ink-faint transition-colors hover:text-ink" aria-label="Close">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {isLoading && (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        )}

        {!isLoading && (!data?.items || data.items.length === 0) && (
          <div className="py-12 text-center text-sm text-ink-faint">No notifications</div>
        )}

        {data?.items.map((notif) => (
          <div
            key={notif.publicId}
            role="button"
            tabIndex={0}
            onClick={() => open(notif)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(notif); } }}
            className={`flex cursor-pointer gap-3 border-b border-rule px-4 py-3 transition-colors hover:bg-surface-hover ${
              !notif.isRead ? 'bg-accent-wash/40' : ''
            }`}
          >
            <div className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${notif.isRead ? 'bg-transparent' : 'bg-danger'}`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{notif.title}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{notif.body}</p>
              <p className="mt-1 text-xs text-ink-faint">
                {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteNotif(notif.publicId);
              }}
              className="flex-shrink-0 text-ink-faint transition-colors hover:text-danger"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {data && data.pagination.totalPages > 1 && (
        <div className="border-t border-rule px-4 py-2 text-center">
          <span className="text-xs text-ink-faint">
            Showing {data.items.length} of {data.pagination.total}
          </span>
        </div>
      )}
    </div>
  );
}
