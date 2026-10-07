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

export interface LinkedParent {
  userPublicId: string;
  firstName: string;
  lastName: string;
  email: string;
}

const keys = {
  list: () => ['student', 'parent-requests'] as const,
  linked: () => ['student', 'linked-parents'] as const,
};

export function useLinkedParents() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: keys.linked(),
    queryFn: async () => {
      const { data } = await api.get('/students/me/parents');
      return (data?.data ?? []) as LinkedParent[];
    },
    enabled: isAuthenticated,
  });
}

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.list() });
      qc.invalidateQueries({ queryKey: keys.linked() });
    },
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
