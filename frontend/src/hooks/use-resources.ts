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

// A 2-element prefix (no trailing `params`) so invalidation matches the list
// query regardless of what params it was fetched with — passing a 3rd element
// of `undefined` would only match a query fetched with no params at all.
const tutorListPrefix = [...resourceKeys.all, 'tutor'] as const;

export function useCreateResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateResourceDto) => resourcesService.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: tutorListPrefix }),
  });
}

export function useUpdateResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: { title?: string; description?: string } }) =>
      resourcesService.update(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: tutorListPrefix }),
  });
}

export function useDeleteResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => resourcesService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: tutorListPrefix }),
  });
}
