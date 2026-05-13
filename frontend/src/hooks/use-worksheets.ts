import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { worksheetsService } from '../services/worksheets.service';
import type { CreateWorksheetDto, UpdateWorksheetDto } from '../services/worksheets.service';

export const worksheetKeys = {
  all: ['worksheets'] as const,
  myAsTutor: (p?: Record<string, string>) => [...worksheetKeys.all, 'tutor', p] as const,
  myAsStudent: (p?: Record<string, string>) => [...worksheetKeys.all, 'student', p] as const,
  detail: (id: string) => [...worksheetKeys.all, id] as const,
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

export function useWorksheet(id: string) {
  return useQuery({
    queryKey: worksheetKeys.detail(id),
    queryFn: () => worksheetsService.getById(id),
    enabled: !!id,
  });
}

export function useCreateWorksheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateWorksheetDto) => worksheetsService.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: worksheetKeys.myAsTutor() }),
  });
}

export function useUpdateWorksheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateWorksheetDto }) => worksheetsService.update(id, dto),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: worksheetKeys.detail(id) });
      qc.invalidateQueries({ queryKey: worksheetKeys.myAsTutor() });
    },
  });
}

export function usePublishWorksheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => worksheetsService.publish(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: worksheetKeys.all }),
  });
}

export function useUnpublishWorksheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => worksheetsService.unpublish(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: worksheetKeys.all }),
  });
}

export function useDeleteWorksheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => worksheetsService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: worksheetKeys.myAsTutor() }),
  });
}
