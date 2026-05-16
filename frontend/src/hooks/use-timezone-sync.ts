import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/auth.store';
import { api } from '../lib/axios';

/**
 * Silently syncs the browser's IANA timezone to the user's profile once per session.
 * This ensures class times are always displayed in the user's actual local timezone
 * regardless of where they registered or what the DB default ('UTC') was.
 */
export function useTimezoneSync() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const synced = useRef(false);

  useEffect(() => {
    if (!user || synced.current) return;

    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!detected || detected === user.timezone) {
      synced.current = true;
      return;
    }

    synced.current = true;
    api
      .patch('/users/me', { timezone: detected })
      .then(() => setUser({ ...user, timezone: detected }))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.publicId]);
}
