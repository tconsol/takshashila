// frontend/src/hooks/use-programs.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { programsService } from '../services/programs.service';
import type { ProgramInput } from '../services/programs.service';
import type { AvailabilityWindow } from '../services/courses.service';
import { useToast } from '../components/ui/Toast';

export const programKeys = {
  all: ['programs'] as const,
  catalog: (p: Record<string, string>) => [...programKeys.all, 'catalog', p] as const,
  mine: () => [...programKeys.all, 'mine'] as const,
  detail: (id: string) => [...programKeys.all, 'detail', id] as const,
  enrollments: (id: string) => [...programKeys.all, 'enrollments', id] as const,
  myEnrollments: () => [...programKeys.all, 'my-enrollments'] as const,
  children: () => [...programKeys.all, 'children'] as const,
  structure: (id: string) => [...programKeys.all, 'structure', id] as const,
  admin: (p: Record<string, string>) => [...programKeys.all, 'admin', p] as const,
};

export const usePrograms = (params: Record<string, string>) =>
  useQuery({ queryKey: programKeys.catalog(params), queryFn: () => programsService.catalog(params) });
export const useMyPrograms = () => useQuery({ queryKey: programKeys.mine(), queryFn: programsService.mine });
export const useProgram = (id?: string) =>
  useQuery({ queryKey: programKeys.detail(id ?? ''), queryFn: () => programsService.get(id!), enabled: !!id });
export const useProgramEnrollments = (id?: string) =>
  useQuery({ queryKey: programKeys.enrollments(id ?? ''), queryFn: () => programsService.enrollments(id!), enabled: !!id });
export const useMyEnrollments = () => useQuery({ queryKey: programKeys.myEnrollments(), queryFn: programsService.myEnrollments });
export const useChildrenEnrollments = () => useQuery({ queryKey: programKeys.children(), queryFn: programsService.childrenEnrollments });
export const useEnrollmentStructure = (id?: string) =>
  useQuery({ queryKey: programKeys.structure(id ?? ''), queryFn: () => programsService.structure(id!), enabled: !!id });
export const useAdminPrograms = (params: Record<string, string>) =>
  useQuery({ queryKey: programKeys.admin(params), queryFn: () => programsService.adminList(params) });

function useProgramMutation<V, R>(fn: (v: V) => Promise<R>, ok: string, fail: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { qc.invalidateQueries({ queryKey: programKeys.all }); qc.invalidateQueries({ queryKey: ['classes'] }); toast.success(ok); },
    onError: (err: Error) => toast.error(fail, err.message),
  });
}

export const useCreateProgram = () => useProgramMutation((dto: ProgramInput) => programsService.create(dto), 'Program created', 'Could not create program');
export const useUpdateProgram = () =>
  useProgramMutation(({ id, dto }: { id: string; dto: Partial<ProgramInput> }) => programsService.update(id, dto), 'Program updated', 'Could not update program');
export const useSetProgramStatus = () =>
  useProgramMutation(({ id, action }: { id: string; action: 'publish' | 'archive' }) => programsService.setStatus(id, action), 'Program updated', 'Could not update program');
export const useDeleteProgram = () => useProgramMutation((id: string) => programsService.remove(id), 'Program deleted', 'Could not delete program');
export const useEnroll = () =>
  useProgramMutation(({ id, availabilityWindow }: { id: string; availabilityWindow: AvailabilityWindow }) => programsService.enroll(id, availabilityWindow), 'Enrolled', 'Could not enroll');
export const useScheduleSession = () =>
  useProgramMutation(
    ({ enrollmentId, dto }: { enrollmentId: string; dto: { startUTC: string; endUTC: string; title: string; programModulePublicId: string } }) =>
      programsService.scheduleSession(enrollmentId, dto),
    'Session scheduled', 'Could not schedule session');
export const useCancelEnrollment = () =>
  useProgramMutation((enrollmentId: string) => programsService.cancel(enrollmentId), 'Enrollment cancelled', 'Could not cancel enrollment');
export const useUnpublishProgram = () => useProgramMutation((id: string) => programsService.unpublish(id), 'Program unpublished', 'Could not unpublish');
