import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { joinRequestsService } from '../services/join-requests.service';

export function useActivePrincipals(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['principals', 'active', params],
    queryFn: () => joinRequestsService.listActivePrincipals(params),
    staleTime: 30_000,
  });
}

export function useIncomingJoinRequests() {
  return useQuery({
    queryKey: ['join-requests', 'incoming'],
    queryFn: () => joinRequestsService.listIncoming(),
    staleTime: 10_000,
  });
}

export function useOutgoingJoinRequests() {
  return useQuery({
    queryKey: ['join-requests', 'outgoing'],
    queryFn: () => joinRequestsService.listOutgoing(),
    staleTime: 10_000,
  });
}

export function useSendTutorRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ principalProfilePublicId, message }: { principalProfilePublicId: string; message?: string }) =>
      joinRequestsService.sendTutorRequest(principalProfilePublicId, message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['join-requests', 'outgoing'] });
    },
  });
}

export function useSendPrincipalRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ query, message }: { query: string; message?: string }) =>
      joinRequestsService.sendPrincipalRequest(query, message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['join-requests', 'outgoing'] });
    },
  });
}

export function useApproveJoinRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) => joinRequestsService.approve(publicId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['join-requests'] });
      qc.invalidateQueries({ queryKey: ['tutors'] });
    },
  });
}


export function useRejectJoinRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ publicId, reason }: { publicId: string; reason?: string }) =>
      joinRequestsService.reject(publicId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['join-requests'] });
    },
  });
}

export function useCancelJoinRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) => joinRequestsService.cancel(publicId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['join-requests', 'outgoing'] });
    },
  });
}

export function useSearchTutor(q: string) {
  return useQuery({
    queryKey: ['tutor-search', q],
    queryFn: () => joinRequestsService.searchTutor(q),
    enabled: q.trim().length >= 3,
    staleTime: 0,
  });
}
