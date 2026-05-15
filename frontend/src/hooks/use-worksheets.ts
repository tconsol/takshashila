import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { worksheetsService } from '../services/worksheets.service';
import type { CreateWorksheetDto } from '../services/worksheets.service';

export const worksheetKeys = {
  all: ['worksheets'] as const,
  myAsTutor: (p?: Record<string, string>) => [...worksheetKeys.all, 'tutor', p] as const,
  myAsStudent: (p?: Record<string, string>) => [...worksheetKeys.all, 'student', p] as const,
  detail: (id: string) => [...worksheetKeys.all, id] as const,
  submissions: (id: string) => [...worksheetKeys.all, id, 'submissions'] as const,
  mySubmission: (id: string) => [...worksheetKeys.all, id, 'my-submission'] as const,
};

export function useMyWorksheetsAsTutor(params?: Record<string, string>) {
  return useQuery({
    queryKey: worksheetKeys.myAsTutor(params),
    queryFn: () => worksheetsService.getMyAsTutor(params),
  });
}

export function useMyWorksheetsAsStudent(params?: Record<string, string>) {
  return useQuery({
    queryKey: worksheetKeys.myAsStudent(params),
    queryFn: () => worksheetsService.getMyAsStudent(params),
  });
}

export function useWorksheetSubmissions(worksheetId: string) {
  return useQuery({
    queryKey: worksheetKeys.submissions(worksheetId),
    queryFn: () => worksheetsService.getSubmissions(worksheetId),
    enabled: !!worksheetId,
  });
}

export function useCreateWorksheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateWorksheetDto) => worksheetsService.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: worksheetKeys.myAsTutor() });
      qc.invalidateQueries({ queryKey: ['badges'] });
    },
  });
}

export function useDeleteWorksheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => worksheetsService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: worksheetKeys.myAsTutor() }),
  });
}

export function useSubmitWorksheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, answers, timeTakenSeconds }: { id: string; answers: number[]; timeTakenSeconds?: number }) =>
      worksheetsService.submitAnswers(id, answers, timeTakenSeconds),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: worksheetKeys.myAsStudent() });
      qc.invalidateQueries({ queryKey: worksheetKeys.mySubmission(id) });
      qc.invalidateQueries({ queryKey: ['badges'] });
    },
  });
}
