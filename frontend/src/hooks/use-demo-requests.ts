import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { demoRequestsService } from '../services/demo-requests.service';
import type { CreateDemoRequestDto } from '../services/demo-requests.service';
import { useToast } from '../components/ui/Toast';

export const demoRequestKeys = {
  all: ['demo-requests'] as const,
  asTutor: (params?: Record<string, string>) => [...demoRequestKeys.all, 'tutor', params] as const,
  asStudent: (params?: Record<string, string>) => [...demoRequestKeys.all, 'student', params] as const,
};

export function useDemoRequestsAsTutor(params?: Record<string, string>, enabled = true) {
  return useQuery({
    queryKey: demoRequestKeys.asTutor(params),
    queryFn: () => demoRequestsService.getMyAsTutor(params),
    enabled,
  });
}

export function useDemoRequestsAsStudent(params?: Record<string, string>) {
  return useQuery({
    queryKey: demoRequestKeys.asStudent(params),
    queryFn: () => demoRequestsService.getMyAsStudent(params),
  });
}

export function useCreateDemoRequest() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (dto: CreateDemoRequestDto) => demoRequestsService.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: demoRequestKeys.all });
      toast.success('Demo request sent!', 'The tutor will review and respond shortly.');
    },
    onError: (err: Error) => {
      toast.error('Request failed', err.message);
    },
  });
}

export function useAcceptDemoRequest() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (requestId: string) => demoRequestsService.accept(requestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: demoRequestKeys.all });
      qc.invalidateQueries({ queryKey: ['classes'] });
      toast.success('Request accepted!', 'Demo class has been scheduled automatically.');
    },
    onError: (err: Error) => {
      toast.error('Could not accept request', err.message);
    },
  });
}

export function useRejectDemoRequest() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason: string }) =>
      demoRequestsService.reject(requestId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: demoRequestKeys.all });
      toast.info('Request rejected', 'The student has been notified.');
    },
    onError: (err: Error) => {
      toast.error('Could not reject request', err.message);
    },
  });
}
