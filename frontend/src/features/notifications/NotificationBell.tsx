import { useState, useRef, useEffect, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { useUnreadCount, useInvalidateNotifications } from './use-notifications';
import { NotificationPanel } from './NotificationPanel';
import { useNotificationSocket } from '../../sockets/notification.socket';
import { realtime } from '../../lib/realtime';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: unreadCount = 0 } = useUnreadCount();
  const invalidate = useInvalidateNotifications();
  const ref = useRef<HTMLDivElement>(null);

  const handleNew = useCallback(() => {
    invalidate();
  }, [invalidate]);

  useNotificationSocket(handleNew);

  // Announcements are fanned out through the realtime transport, which is
  // Pusher whenever quota allows — the Socket.IO listener alone misses those.
  useEffect(() => realtime.on('notification:new', handleNew), [handleNew]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-60" />
            <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {open && <NotificationPanel onClose={() => setOpen(false)} />}
    </div>
  );
}
