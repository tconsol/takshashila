import { useEffect } from 'react';
import { useAuthStore } from '../stores/auth.store';

function getTokenExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

// Checks every minute whether the access token has expired and logs out if so.
export function useSessionExpiry() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  useEffect(() => {
    if (!accessToken) return;

    const expiry = getTokenExpiry(accessToken);
    if (!expiry) return;

    const msUntilExpiry = expiry - Date.now();
    if (msUntilExpiry <= 0) {
      clearAuth();
      window.location.href = '/login';
      return;
    }

    // Schedule logout exactly when the token expires
    const timer = setTimeout(() => {
      clearAuth();
      window.location.href = '/login';
    }, msUntilExpiry);

    return () => clearTimeout(timer);
  }, [accessToken, clearAuth]);
}
