import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/axios';
import type { INotification } from './notification.types';
import type { PaginatedResult } from '../../shared/types';

const notifKeys = {
  all: ['notifications'] as const,
  list: (page: number) => ['notifications', 'list', page] as const,
  unread: () => ['notifications', 'unread-count'] as const,
};

export function useNotifications(page = 1) {
  return useQuery<PaginatedResult<INotification>>({
    queryKey: notifKeys.list(page),
    queryFn: async () => {
      const { data } = await api.get('/notifications', { params: { page, limit: 10 } });
      return data;
    },
    staleTime: 30_000,
  });
}

export function useUnreadCount() {
  return useQuery<number>({
    queryKey: notifKeys.unread(),
    queryFn: async () => {
      const { data } = await api.get('/notifications/unread-count');
      return data.count;
    },
    refetchInterval: 60_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) => api.patch(`/notifications/${publicId}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notifKeys.all });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notifKeys.all });
    },
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) => api.delete(`/notifications/${publicId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notifKeys.all });
    },
  });
}

export function useInvalidateNotifications() {
  const qc = useQueryClient();
  return useCallback(() => {
    qc.invalidateQueries({ queryKey: notifKeys.all });
  }, [qc]);
}
