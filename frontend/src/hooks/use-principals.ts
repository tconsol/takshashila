import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { principalsService } from '../services/principals.service';

export const principalKeys = {
  all: ['principals'] as const,
  myProfile: () => [...principalKeys.all, 'me'] as const,
  detail: (id: string) => [...principalKeys.all, id] as const,
  list: (params?: Record<string, string>) => [...principalKeys.all, 'list', params] as const,
  pending: (params?: Record<string, string>) => [...principalKeys.all, 'pending', params] as const,
};

export function useMyPrincipalProfile() {
  return useQuery({
    queryKey: principalKeys.myProfile(),
    queryFn: principalsService.getMyProfile,
  });
}

export function usePrincipalList(params?: Record<string, string>) {
  return useQuery({
    queryKey: principalKeys.list(params),
    queryFn: () => principalsService.listAll(params),
  });
}

export function usePendingPrincipals(params?: Record<string, string>) {
  return useQuery({
    queryKey: principalKeys.pending(params),
    queryFn: () => principalsService.listPending(params),
  });
}

export function useApprovePrincipal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) => principalsService.approve(publicId),
    onSuccess: () => qc.invalidateQueries({ queryKey: principalKeys.all }),
  });
}

export function useSuspendPrincipal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) => principalsService.suspend(publicId),
    onSuccess: () => qc.invalidateQueries({ queryKey: principalKeys.all }),
  });
}
