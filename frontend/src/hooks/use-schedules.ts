import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { schedulesService } from '../services/schedules.service';
import type { CreateSlotDto } from '../services/schedules.service';

export const scheduleKeys = {
  all: ['schedules'] as const,
  mySlots: (params?: { from?: string; to?: string }) => [...scheduleKeys.all, 'my', params] as const,
  tutorSlots: (tutorId: string, params?: { from?: string; to?: string }) =>
    [...scheduleKeys.all, 'tutor', tutorId, params] as const,
};

export function useMySlots(params?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: scheduleKeys.mySlots(params),
    queryFn: () => schedulesService.getMySlots(params),
  });
}

export function useTutorSlots(tutorPublicId: string, params?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: scheduleKeys.tutorSlots(tutorPublicId, params),
    queryFn: () => schedulesService.getTutorSlots(tutorPublicId, params),
    enabled: !!tutorPublicId,
  });
}

export function useCreateSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateSlotDto) => schedulesService.createSlot(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduleKeys.all }),
  });
}

export function useDeleteSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotPublicId: string) => schedulesService.deleteSlot(slotPublicId),
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduleKeys.all }),
  });
}

export function useCancelSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotPublicId: string) => schedulesService.cancelSlot(slotPublicId),
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduleKeys.all }),
  });
}

export function useRescheduleSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slotPublicId, startUTC, endUTC }: { slotPublicId: string; startUTC: string; endUTC: string }) =>
      schedulesService.rescheduleSlot(slotPublicId, { startUTC, endUTC }),
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduleKeys.all }),
  });
}
