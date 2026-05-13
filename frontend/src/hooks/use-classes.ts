import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { classesService } from '../services/classes.service';
import type { BookClassDto, CancelClassDto } from '../services/classes.service';

export const classKeys = {
  all: ['classes'] as const,
  asTutor: (params?: Record<string, string>) => [...classKeys.all, 'tutor', params] as const,
  asStudent: (params?: Record<string, string>) => [...classKeys.all, 'student', params] as const,
  detail: (id: string) => [...classKeys.all, id] as const,
};

export function useMyClassesAsTutor(params?: Record<string, string>) {
  return useQuery({
    queryKey: classKeys.asTutor(params),
    queryFn: () => classesService.getMyAsTutor(params),
  });
}

export function useMyClassesAsStudent(params?: Record<string, string>) {
  return useQuery({
    queryKey: classKeys.asStudent(params),
    queryFn: () => classesService.getMyAsStudent(params),
  });
}

export function useClass(classId: string) {
  return useQuery({
    queryKey: classKeys.detail(classId),
    queryFn: () => classesService.getById(classId),
    enabled: !!classId,
  });
}

export function useBookClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: BookClassDto) => classesService.book(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: classKeys.all }),
  });
}

export function useStartClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (classId: string) => classesService.start(classId),
    onSuccess: (_, classId) => {
      qc.invalidateQueries({ queryKey: classKeys.detail(classId) });
      qc.invalidateQueries({ queryKey: classKeys.all });
    },
  });
}

export function useCompleteClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (classId: string) => classesService.complete(classId),
    onSuccess: (_, classId) => {
      qc.invalidateQueries({ queryKey: classKeys.detail(classId) });
      qc.invalidateQueries({ queryKey: classKeys.all });
    },
  });
}

export function useCancelClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, dto }: { classId: string; dto: CancelClassDto }) =>
      classesService.cancel(classId, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: classKeys.all }),
  });
}

export function useSetMeetingUrl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, url }: { classId: string; url: string }) =>
      classesService.setMeetingUrl(classId, url),
    onSuccess: (_, { classId }) => qc.invalidateQueries({ queryKey: classKeys.detail(classId) }),
  });
}
