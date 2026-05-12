import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assignmentsService } from '../services/assignments.service';
import type { CreateAssignmentDto } from '../services/assignments.service';

export const assignmentKeys = {
  all: ['assignments'] as const,
  my: () => [...assignmentKeys.all, 'my'] as const,
  byClass: (classId: string) => [...assignmentKeys.all, 'class', classId] as const,
  detail: (id: string) => [...assignmentKeys.all, id] as const,
  submissions: (id: string) => [...assignmentKeys.all, id, 'submissions'] as const,
  mySubmission: (id: string) => [...assignmentKeys.all, id, 'my-submission'] as const,
};

export function useMyAssignments() {
  return useQuery({
    queryKey: assignmentKeys.my(),
    queryFn: assignmentsService.getMyAssignments,
  });
}

export function useAssignmentsByClass(classId: string) {
  return useQuery({
    queryKey: assignmentKeys.byClass(classId),
    queryFn: () => assignmentsService.getByClass(classId),
    enabled: !!classId,
  });
}

export function useAssignment(id: string) {
  return useQuery({
    queryKey: assignmentKeys.detail(id),
    queryFn: () => assignmentsService.getById(id),
    enabled: !!id,
  });
}

export function useSubmissions(assignmentId: string) {
  return useQuery({
    queryKey: assignmentKeys.submissions(assignmentId),
    queryFn: () => assignmentsService.getSubmissions(assignmentId),
    enabled: !!assignmentId,
  });
}

export function useMySubmission(assignmentId: string) {
  return useQuery({
    queryKey: assignmentKeys.mySubmission(assignmentId),
    queryFn: () => assignmentsService.getMySubmission(assignmentId),
    enabled: !!assignmentId,
  });
}

export function useCreateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateAssignmentDto) => assignmentsService.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: assignmentKeys.my() }),
  });
}

export function usePublishAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => assignmentsService.publish(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: assignmentKeys.all }),
  });
}

export function useCloseAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => assignmentsService.close(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: assignmentKeys.all }),
  });
}

export function useSubmitAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: { content?: string; attachmentPublicIds?: string[] } }) =>
      assignmentsService.submit(id, dto),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: assignmentKeys.mySubmission(id) });
      qc.invalidateQueries({ queryKey: assignmentKeys.byClass('') });
    },
  });
}

export function useGradeSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId, dto }: { submissionId: string; assignmentId: string; dto: { score: number; feedback?: string } }) =>
      assignmentsService.gradeSubmission(submissionId, dto),
    onSuccess: (_, { assignmentId }) => {
      qc.invalidateQueries({ queryKey: assignmentKeys.submissions(assignmentId) });
    },
  });
}
