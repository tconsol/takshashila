import { create } from 'zustand';
import { tokenStorage } from '../lib/token';
import type { User } from '../types/api.types';

interface AuthState {
  user: User | null;
  setAuth: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
  clearAuth: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,

  setAuth: async (user, accessToken, refreshToken) => {
    await tokenStorage.setTokens(accessToken, refreshToken);
    set({ user });
  },

  clearAuth: async () => {
    await tokenStorage.clearTokens();
    set({ user: null });
  },

  setUser: (user) => set({ user }),
}));
