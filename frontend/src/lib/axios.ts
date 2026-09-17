import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 15000,
});

// ── Token helpers ─────────────────────────────────────────────────────────────

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = typeof payload.exp === 'number' ? payload.exp : 0;
    return Math.floor(Date.now() / 1000) >= exp;
  } catch {
    return true;
  }
}

function logout() {
  useAuthStore.getState().clearAuth();
  window.location.href = '/login';
}

// ── Request interceptor attach token, auto-logout if expired ───────────────

api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (!accessToken) return config;

  if (isTokenExpired(accessToken)) {
    logout();
    return Promise.reject(new Error('Session expired. Please log in again.'));
  }

  config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// ── Response interceptor handle unexpected 401s ────────────────────────────

// Public auth endpoints: a 401/failure here is the login attempt itself failing,
// NOT an expired session — must not trigger the global auto-logout redirect,
// otherwise the component never sees the real error.
const PUBLIC_AUTH_ENDPOINTS = [
  '/auth/login', '/auth/refresh', '/auth/google', '/auth/register',
  '/auth/resend-verification', '/auth/verify-email', '/auth/forgot-password',
  '/auth/reset-password', '/auth/accept-invite',
];

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const url: string = error.config?.url ?? '';
    const isPublicAuth = PUBLIC_AUTH_ENDPOINTS.some((p) => url.includes(p));

    if (error.response?.status === 401 && !isPublicAuth) {
      logout();
    }

    const apiMessage = error.response?.data?.message;
    if (apiMessage) error.message = apiMessage;
    return Promise.reject(error);
  },
);
