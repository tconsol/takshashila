import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/axios';
import { useAuthStore } from '../stores/auth.store';

export interface ParentLinkRequest {
  publicId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  parent: {
    userPublicId: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

const keys = {
  list: () => ['student', 'parent-requests'] as const,
};

export function useParentLinkRequests() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: keys.list(),
    queryFn: async () => {
      const { data } = await api.get('/students/me/parent-requests');
      return (data?.data ?? []) as ParentLinkRequest[];
    },
    enabled: isAuthenticated,
  });
}

export function useApproveParentRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestPublicId: string) =>
      api.post(`/students/me/parent-requests/${requestPublicId}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.list() }),
  });
}

export function useRejectParentRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestPublicId: string) =>
      api.post(`/students/me/parent-requests/${requestPublicId}/reject`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.list() }),
  });
}
