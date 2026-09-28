import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '../types';
import { useDismissedBadgesStore } from './dismissed-badges.store';

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (token: string) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

const AUTH_STORAGE_KEY = 'brainbaseedu-auth';

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      setAuth: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true, isLoading: false }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setUser: (user) => set({ user }),
      clearAuth: () => {
        localStorage.clear();
        sessionStorage.clear();
        useDismissedBadgesStore.getState().reset(); // clear badge "seen" so next user starts fresh
        set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
      },
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated, accessToken: state.accessToken }),
    },
  ),
);

// Auth is persisted to localStorage, which every tab of this origin shares.
// Logging into a different account in one tab (or signing out) otherwise
// leaves other open tabs holding a stale in-memory user/token while their
// API calls silently start using whatever is now in localStorage — a tab can
// end up showing one account's name with another account's data. Reloading
// on change keeps every open tab fully consistent with whichever session is
// actually current, instead of drifting.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === AUTH_STORAGE_KEY && event.newValue !== event.oldValue) {
      window.location.reload();
    }
  });
}
