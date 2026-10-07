// frontend/src/hooks/use-curricula.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { curriculaService } from '../services/curricula.service';
import type { MaterialKind } from '../services/curricula.service';
import type { CreateCurriculumDto, UpdateCurriculumDto, ImportOptions } from '../services/curricula.service';
import { useToast } from '../components/ui/Toast';

export const curriculumKeys = {
  all: ['curricula'] as const,
  detail: (id: string) => [...curriculumKeys.all, 'detail', id] as const,
  tutors: (id: string) => [...curriculumKeys.all, 'tutors', id] as const,
  attachable: ['curricula', 'attachable'] as const,
};

/** State-based catalog; no `grade` = all grades. */
export function useStateCatalog(stateCode: string | undefined, grade?: string) {
  return useQuery({
    queryKey: [...curriculumKeys.all, 'state-catalog', stateCode ?? '', grade ?? 'all'] as const,
    queryFn: () => curriculaService.getStateCatalog(stateCode!, grade),
    enabled: !!stateCode,
  });
}

/** Admin: states that have curricula. */
export function useAdminStates() {
  return useQuery({ queryKey: [...curriculumKeys.all, 'admin-states'] as const, queryFn: curriculaService.adminStates });
}

/** Admin: every curriculum of a state in a light form. */
export function useAdminOverview(stateCode: string | undefined) {
  return useQuery({
    queryKey: [...curriculumKeys.all, 'admin-overview', stateCode ?? ''] as const,
    queryFn: () => curriculaService.adminOverview(stateCode!),
    enabled: !!stateCode,
  });
}

export function useCurriculum(curriculumPublicId: string | undefined) {
  return useQuery({
    queryKey: curriculumKeys.detail(curriculumPublicId ?? ''),
    queryFn: () => curriculaService.getByPublicId(curriculumPublicId!),
    enabled: !!curriculumPublicId,
  });
}

export function useCurriculumTutors(curriculumPublicId: string | undefined) {
  return useQuery({
    queryKey: curriculumKeys.tutors(curriculumPublicId ?? ''),
    queryFn: () => curriculaService.listTutors(curriculumPublicId!),
    enabled: !!curriculumPublicId,
  });
}

/** Preview (commit: false) or import (commit: true) a Word file. Only a real import refreshes the lists. */
export function useImportCurriculumDocx() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ file, ...opts }: { file: File } & ImportOptions) => curriculaService.importDocx(file, opts),
    onSuccess: (res) => {
      if (res.committed) {
        qc.invalidateQueries({ queryKey: curriculumKeys.all });
        toast.success('Curricula imported as drafts');
      }
    },
    onError: (err: Error) => toast.error('Could not read the file', err.message),
  });
}

export function useCreateCurriculum() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (dto: CreateCurriculumDto) => curriculaService.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: curriculumKeys.all });
      toast.success('Curriculum created');
    },
    onError: (err: Error) => toast.error('Could not create curriculum', err.message),
  });
}

export function useUpdateCurriculum() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ curriculumPublicId, dto }: { curriculumPublicId: string; dto: UpdateCurriculumDto }) =>
      curriculaService.update(curriculumPublicId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: curriculumKeys.all });
      toast.success('Curriculum updated');
    },
    onError: (err: Error) => toast.error('Could not update curriculum', err.message),
  });
}

export function useDeleteCurriculum() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (curriculumPublicId: string) => curriculaService.remove(curriculumPublicId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: curriculumKeys.all });
      toast.success('Curriculum deleted');
    },
    onError: (err: Error) => toast.error('Could not delete curriculum', err.message),
  });
}

export function usePublishCurriculum() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ curriculumPublicId, publish }: { curriculumPublicId: string; publish: boolean }) =>
      publish ? curriculaService.publish(curriculumPublicId) : curriculaService.unpublish(curriculumPublicId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: curriculumKeys.all });
      toast.success(vars.publish ? 'Curriculum published' : 'Curriculum unpublished');
    },
    onError: (err: Error) => toast.error('Could not update curriculum', err.message),
  });
}

export function useAttachableCurricula(enabled = true) {
  return useQuery({ queryKey: curriculumKeys.attachable, queryFn: curriculaService.listAttachable, enabled, staleTime: 60_000 });
}

export function useCurriculumStructure(curriculumPublicId: string) {
  return useQuery({
    queryKey: [...curriculumKeys.all, 'structure', curriculumPublicId],
    queryFn: () => curriculaService.getStructure(curriculumPublicId),
    enabled: !!curriculumPublicId,
  });
}

export function useAddCurriculumMaterial() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ curriculumPublicId, kind, body }: { curriculumPublicId: string; kind: MaterialKind; body: Record<string, unknown> }) =>
      curriculaService.addMaterial(curriculumPublicId, kind, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: curriculumKeys.all }); toast.success('Material added'); },
    onError: (err: Error) => toast.error('Could not add material', err.message),
  });
}

export function useDeleteCurriculumMaterial() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ curriculumPublicId, kind, materialPublicId }: { curriculumPublicId: string; kind: MaterialKind; materialPublicId: string }) =>
      curriculaService.deleteMaterial(curriculumPublicId, kind, materialPublicId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: curriculumKeys.all }); toast.success('Material deleted'); },
    onError: (err: Error) => toast.error('Could not delete material', err.message),
  });
}
