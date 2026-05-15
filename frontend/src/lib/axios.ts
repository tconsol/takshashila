import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    const isAuthEndpoint = original.url?.includes('/auth/login') || original.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
        const newAccessToken: string = data.data.accessToken;

        useAuthStore.getState().setAccessToken(newAccessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);

        refreshQueue.forEach((cb) => cb(newAccessToken));
        refreshQueue = [];

        original.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(original);
      } catch {
        refreshQueue = [];
        useAuthStore.getState().clearAuth();
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    // Normalise error message so callers get the API message, not "Request failed with status 404"
    const apiMessage = error.response?.data?.message;
    if (apiMessage) {
      error.message = apiMessage;
    }
    return Promise.reject(error);
  },
);
