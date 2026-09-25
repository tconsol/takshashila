// frontend/src/hooks/use-courses.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coursesService } from '../services/courses.service';
import type { CreateCourseDto, ScheduleCourseClassDto } from '../services/courses.service';
import { useToast } from '../components/ui/Toast';

export const courseKeys = {
  all: ['courses'] as const,
  mine: (params?: Record<string, string>) => [...courseKeys.all, 'mine', params] as const,
  incoming: (params?: Record<string, string>) => [...courseKeys.all, 'incoming', params] as const,
  structure: (id: string) => [...courseKeys.all, 'structure', id] as const,
  children: () => [...courseKeys.all, 'children'] as const,
};

export function useMyCourses(params?: Record<string, string>) {
  return useQuery({
    queryKey: courseKeys.mine(params),
    queryFn: () => coursesService.getMine(params),
  });
}

export function useCourseStructure(coursePublicId: string | undefined) {
  return useQuery({
    queryKey: courseKeys.structure(coursePublicId ?? ''),
    queryFn: () => coursesService.getStructure(coursePublicId!),
    enabled: !!coursePublicId,
  });
}

export function useChildrenCourses() {
  return useQuery({ queryKey: courseKeys.children(), queryFn: coursesService.listForParent });
}

export function useIncomingCourses(params?: Record<string, string>) {
  return useQuery({
    queryKey: courseKeys.incoming(params),
    queryFn: () => coursesService.getIncoming(params),
  });
}

export function useCreateCourse() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (dto: CreateCourseDto) => coursesService.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseKeys.all });
      toast.success('Course sent to tutor', 'The tutor will review and respond shortly.');
    },
    onError: (err: Error) => toast.error('Could not send course', err.message),
  });
}

export function useAcceptCourse() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ coursePublicId, classesRequired }: { coursePublicId: string; classesRequired: number }) =>
      coursesService.accept(coursePublicId, classesRequired),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseKeys.all });
      toast.success('Course accepted', 'You can now schedule the classes.');
    },
    onError: (err: Error) => toast.error('Could not accept course', err.message),
  });
}

export function useRejectCourse() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ coursePublicId, reason }: { coursePublicId: string; reason: string }) =>
      coursesService.reject(coursePublicId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseKeys.all });
      toast.info('Request rejected');
    },
    onError: (err: Error) => toast.error('Could not reject course', err.message),
  });
}

export function useScheduleCourseClass() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ coursePublicId, dto }: { coursePublicId: string; dto: ScheduleCourseClassDto }) =>
      coursesService.scheduleClass(coursePublicId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseKeys.all });
      qc.invalidateQueries({ queryKey: ['classes'] });
      toast.success('Class scheduled');
    },
    onError: (err: Error) => toast.error('Could not schedule class', err.message),
  });
}

export function useCancelCourse() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (coursePublicId: string) => coursesService.cancel(coursePublicId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseKeys.all });
      qc.invalidateQueries({ queryKey: ['classes'] });
      toast.info('Course request cancelled');
    },
    onError: (err: Error) => toast.error('Could not cancel course', err.message),
  });
}

export function useMaterialSubmissions(coursePublicId: string, kind: 'assignment' | 'worksheet', materialPublicId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...courseKeys.all, 'material-submissions', coursePublicId, kind, materialPublicId],
    queryFn: () => coursesService.getMaterialSubmissions(coursePublicId, kind, materialPublicId),
    enabled,
  });
}
