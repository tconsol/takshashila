import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentsService } from '../services/students.service';
import type { CreateStudentDto } from '../services/students.service';

export const studentKeys = {
  all: ['students'] as const,
  myProfile: () => [...studentKeys.all, 'me'] as const,
  detail: (id: string) => [...studentKeys.all, id] as const,
  pending: () => [...studentKeys.all, 'pending'] as const,
  list: (params?: Record<string, string>) => [...studentKeys.all, 'list', params] as const,
  myTutorStudents: (params?: Record<string, string>) => [...studentKeys.all, 'my-tutor', params] as const,
};

export function useMyStudentProfile() {
  return useQuery({
    queryKey: studentKeys.myProfile(),
    queryFn: studentsService.getMyProfile,
  });
}

export function useStudentProfile(publicId: string) {
  return useQuery({
    queryKey: studentKeys.detail(publicId),
    queryFn: () => studentsService.getByPublicId(publicId),
    enabled: !!publicId,
  });
}

export function usePendingStudents() {
  return useQuery({
    queryKey: studentKeys.pending(),
    queryFn: studentsService.listPending,
  });
}

export function useStudentList(params?: Record<string, string>) {
  return useQuery({
    queryKey: studentKeys.list(params),
    queryFn: () => studentsService.listAll(params),
  });
}

export function useApproveStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) => studentsService.approve(publicId),
    onSuccess: () => qc.invalidateQueries({ queryKey: studentKeys.all }),
  });
}

export function useSuspendStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ publicId, reason }: { publicId: string; reason: string }) =>
      studentsService.suspend(publicId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: studentKeys.all }),
  });
}

export function useMyStudentsAsTutor(params?: Record<string, string>) {
  return useQuery({
    queryKey: studentKeys.myTutorStudents(params),
    queryFn: () => studentsService.getMyStudentsAsTutor(params),
  });
}

export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateStudentDto) => studentsService.createStudent(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: studentKeys.myTutorStudents() }),
  });
}
