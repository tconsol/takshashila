import type { AxiosError } from 'axios';

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (!error) return fallback;
  const axiosErr = error as AxiosError<{ message?: string; error?: string }>;
  return (
    axiosErr.response?.data?.message ??
    axiosErr.response?.data?.error ??
    axiosErr.message ??
    fallback
  );
}

export function isUnauthorized(error: unknown): boolean {
  return (error as AxiosError)?.response?.status === 401;
}

export function isNotFound(error: unknown): boolean {
  return (error as AxiosError)?.response?.status === 404;
}

export function isForbidden(error: unknown): boolean {
  return (error as AxiosError)?.response?.status === 403;
}
