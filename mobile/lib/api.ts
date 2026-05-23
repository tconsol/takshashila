import axios from 'axios';
import { router } from 'expo-router';
import { tokenStorage } from './token';
import { useAuthStore } from '../stores/auth.store';

// Use EXPO_PUBLIC_ prefix so Expo includes it in the bundle
const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

api.interceptors.request.use(async (config) => {
  const token = await tokenStorage.getAccessToken();
  if (!token) return config;

  if (tokenStorage.isExpired(token)) {
    useAuthStore.getState().clearAuth();
    router.replace('/(auth)/login');
    return Promise.reject(new Error('Session expired'));
  }

  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const isAuthEndpoint =
      error.config?.url?.includes('/auth/login') ||
      error.config?.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && !isAuthEndpoint) {
      useAuthStore.getState().clearAuth();
      router.replace('/(auth)/login');
    }

    const apiMessage = error.response?.data?.message;
    if (apiMessage) error.message = apiMessage;
    return Promise.reject(error);
  },
);
