import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { classesService } from '../services/classes.service';
import type { BookClassDto, CancelClassDto, TutorCreateClassDto, TutorRescheduleDto } from '../services/classes.service';
import { useToast } from '../components/ui/Toast';

export const classKeys = {
  all: ['classes'] as const,
  asTutor: (params?: Record<string, string>) => [...classKeys.all, 'tutor', params] as const,
  asStudent: (params?: Record<string, string>) => [...classKeys.all, 'student', params] as const,
  asPrincipal: (params?: Record<string, string>) => [...classKeys.all, 'principal', params] as const,
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

export function useMyClassesAsPrincipal(params?: Record<string, string>) {
  return useQuery({
    queryKey: classKeys.asPrincipal(params),
    queryFn: () => classesService.getMyAsPrincipal(params),
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
  const toast = useToast();
  return useMutation({
    mutationFn: (dto: BookClassDto) => classesService.book(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: classKeys.all });
      toast.success('Class booked!', 'Your class has been confirmed.');
    },
    onError: (err: Error) => {
      toast.error('Booking failed', err.message);
    },
  });
}

export function useStartClass() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (classId: string) => classesService.start(classId),
    onSuccess: (_, classId) => {
      qc.invalidateQueries({ queryKey: classKeys.detail(classId) });
      qc.invalidateQueries({ queryKey: classKeys.all });
      toast.success('Class started!');
    },
    onError: (err: Error) => {
      toast.error('Could not start class', err.message);
    },
  });
}

export function useCompleteClass() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (classId: string) => classesService.complete(classId),
    onSuccess: (_, classId) => {
      qc.invalidateQueries({ queryKey: classKeys.detail(classId) });
      qc.invalidateQueries({ queryKey: classKeys.all });
      toast.success('Class completed!');
    },
    onError: (err: Error) => {
      toast.error('Could not complete class', err.message);
    },
  });
}

export function useCancelClass() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ classId, dto }: { classId: string; dto: CancelClassDto }) =>
      classesService.cancel(classId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: classKeys.all });
      toast.warning('Class cancelled', 'The class has been removed from your schedule.');
    },
    onError: (err: Error) => {
      toast.error('Could not cancel class', err.message);
    },
  });
}

export function useTutorCreateClass() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (dto: TutorCreateClassDto) => classesService.tutorCreate(dto),
    onSuccess: (classes) => {
      qc.invalidateQueries({ queryKey: classKeys.all });
      toast.success(`${classes.length} class${classes.length !== 1 ? 'es' : ''} created!`);
    },
    onError: (err: Error) => toast.error('Could not create class', err.message),
  });
}

export function useTutorReschedule() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ classId, dto }: { classId: string; dto: TutorRescheduleDto }) =>
      classesService.tutorReschedule(classId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: classKeys.all });
      toast.success('Class rescheduled!');
    },
    onError: (err: Error) => toast.error('Could not reschedule', err.message),
  });
}

export function useSetMeetingUrl() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ classId, url }: { classId: string; url: string }) =>
      classesService.setMeetingUrl(classId, url),
    onSuccess: (_, { classId }) => {
      qc.invalidateQueries({ queryKey: classKeys.detail(classId) });
      toast.success('Meeting URL updated');
    },
    onError: (err: Error) => {
      toast.error('Could not update URL', err.message);
    },
  });
}
