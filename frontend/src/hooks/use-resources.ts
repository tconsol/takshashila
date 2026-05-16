import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { resourcesService } from '../services/resources.service';
import type { CreateResourceDto } from '../services/resources.service';

export const resourceKeys = {
  all: ['resources'] as const,
  myAsTutor: (p?: Record<string, string>) => [...resourceKeys.all, 'tutor', p] as const,
  myAsStudent: (p?: Record<string, string>) => [...resourceKeys.all, 'student', p] as const,
  detail: (id: string) => [...resourceKeys.all, id] as const,
};

export function useMyResourcesAsTutor(params?: Record<string, string>) {
  return useQuery({
    queryKey: resourceKeys.myAsTutor(params),
    queryFn: () => resourcesService.getMyAsTutor(params),
  });
}

export function useMyResourcesAsStudent(params?: Record<string, string>) {
  return useQuery({
    queryKey: resourceKeys.myAsStudent(params),
    queryFn: () => resourcesService.getMyAsStudent(params),
  });
}

export function useCreateResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateResourceDto) => resourcesService.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: resourceKeys.myAsTutor() }),
  });
}

export function useUpdateResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: { title?: string; description?: string } }) =>
      resourcesService.update(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: resourceKeys.myAsTutor() }),
  });
}

export function useDeleteResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => resourcesService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: resourceKeys.myAsTutor() }),
  });
}
