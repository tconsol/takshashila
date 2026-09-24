// frontend/src/hooks/use-course-requests.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { courseRequestsService } from '../services/course-requests.service';
import type { CreateCourseRequestDto, ScheduleCourseClassDto } from '../services/course-requests.service';
import { useToast } from '../components/ui/Toast';

export const courseRequestKeys = {
  all: ['course-requests'] as const,
  mine: (params?: Record<string, string>) => [...courseRequestKeys.all, 'mine', params] as const,
  incoming: (params?: Record<string, string>) => [...courseRequestKeys.all, 'incoming', params] as const,
  progress: (id: string) => [...courseRequestKeys.all, 'progress', id] as const,
};

export function useCourseRequestsAsStudent(params?: Record<string, string>) {
  return useQuery({
    queryKey: courseRequestKeys.mine(params),
    queryFn: () => courseRequestsService.getMine(params),
  });
}

export function useCourseProgress(requestPublicId: string | undefined) {
  return useQuery({
    queryKey: courseRequestKeys.progress(requestPublicId ?? ''),
    queryFn: () => courseRequestsService.getProgress(requestPublicId!),
    enabled: !!requestPublicId,
  });
}

export function useCourseRequestsAsTutor(params?: Record<string, string>) {
  return useQuery({
    queryKey: courseRequestKeys.incoming(params),
    queryFn: () => courseRequestsService.getIncoming(params),
  });
}

export function useCreateCourseRequest() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (dto: CreateCourseRequestDto) => courseRequestsService.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseRequestKeys.all });
      toast.success('Course request sent!', 'The tutor will review and respond shortly.');
    },
    onError: (err: Error) => toast.error('Request failed', err.message),
  });
}

export function useAcceptCourseRequest() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ requestPublicId, classesRequired }: { requestPublicId: string; classesRequired: number }) =>
      courseRequestsService.accept(requestPublicId, classesRequired),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseRequestKeys.all });
      toast.success('Request accepted', 'You can now schedule the classes.');
    },
    onError: (err: Error) => toast.error('Could not accept request', err.message),
  });
}

export function useRejectCourseRequest() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ requestPublicId, reason }: { requestPublicId: string; reason: string }) =>
      courseRequestsService.reject(requestPublicId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseRequestKeys.all });
      toast.info('Request rejected');
    },
    onError: (err: Error) => toast.error('Could not reject request', err.message),
  });
}

export function useScheduleCourseClass() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ requestPublicId, dto }: { requestPublicId: string; dto: ScheduleCourseClassDto }) =>
      courseRequestsService.scheduleClass(requestPublicId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseRequestKeys.all });
      qc.invalidateQueries({ queryKey: ['classes'] });
      toast.success('Class scheduled');
    },
    onError: (err: Error) => toast.error('Could not schedule class', err.message),
  });
}

export function useCancelCourseRequest() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (requestPublicId: string) => courseRequestsService.cancel(requestPublicId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseRequestKeys.all });
      qc.invalidateQueries({ queryKey: ['classes'] });
      toast.info('Course request cancelled');
    },
    onError: (err: Error) => toast.error('Could not cancel request', err.message),
  });
}
