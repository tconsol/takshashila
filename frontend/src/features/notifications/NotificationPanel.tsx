import { formatDistanceToNow } from 'date-fns';
import { useNotifications, useMarkRead, useMarkAllRead, useDeleteNotification } from './use-notifications';
import { Spinner } from '../../components/ui/Loading';

interface Props {
  onClose: () => void;
}

export function NotificationPanel({ onClose }: Props) {
  const { data, isLoading } = useNotifications();
  const { mutate: markRead } = useMarkRead();
  const { mutate: markAllRead } = useMarkAllRead();
  const { mutate: deleteNotif } = useDeleteNotification();

  return (
    <div className="absolute right-0 top-10 z-50 w-96 rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="font-semibold text-gray-900">Notifications</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => markAllRead()}
            className="text-xs text-blue-600 hover:underline"
          >
            Mark all read
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {isLoading && (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        )}

        {!isLoading && (!data?.items || data.items.length === 0) && (
          <div className="py-12 text-center text-sm text-gray-400">
            No notifications
          </div>
        )}

        {data?.items.map((notif) => (
          <div
            key={notif.publicId}
            className={`flex gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${
              !notif.isRead ? 'bg-blue-50/40' : ''
            }`}
            onClick={() => !notif.isRead && markRead(notif.publicId)}
          >
            <div className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${notif.isRead ? 'bg-transparent' : 'bg-blue-500'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{notif.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.body}</p>
              <p className="text-xs text-gray-400 mt-1">
                {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteNotif(notif.publicId);
              }}
              className="text-gray-300 hover:text-red-400 text-xs flex-shrink-0"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {data && data.pagination.totalPages > 1 && (
        <div className="px-4 py-2 border-t border-gray-100 text-center">
          <span className="text-xs text-gray-400">
            Showing {data.items.length} of {data.pagination.total}
          </span>
        </div>
      )}
    </div>
  );
}
