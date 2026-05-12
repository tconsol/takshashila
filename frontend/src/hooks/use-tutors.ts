import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tutorsService } from '../services/tutors.service';
import type { TutorSearchFilters } from '../services/tutors.service';

export const tutorKeys = {
  all: ['tutors'] as const,
  myProfile: () => [...tutorKeys.all, 'me'] as const,
  detail: (id: string) => [...tutorKeys.all, id] as const,
  search: (filters?: TutorSearchFilters) => [...tutorKeys.all, 'search', filters] as const,
  pending: () => [...tutorKeys.all, 'pending'] as const,
};

export function useMyTutorProfile() {
  return useQuery({
    queryKey: tutorKeys.myProfile(),
    queryFn: tutorsService.getMyProfile,
  });
}

export function useTutorProfile(publicId: string) {
  return useQuery({
    queryKey: tutorKeys.detail(publicId),
    queryFn: () => tutorsService.getByPublicId(publicId),
    enabled: !!publicId,
  });
}

export function useTutorSearch(filters?: TutorSearchFilters) {
  return useQuery({
    queryKey: tutorKeys.search(filters),
    queryFn: () => tutorsService.search(filters),
  });
}

export function usePendingTutors() {
  return useQuery({
    queryKey: tutorKeys.pending(),
    queryFn: tutorsService.listPending,
  });
}

export function useApproveTutor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) => tutorsService.approve(publicId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tutorKeys.all });
    },
  });
}

export function useSuspendTutor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ publicId, reason }: { publicId: string; reason: string }) =>
      tutorsService.suspend(publicId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tutorKeys.all });
    },
  });
}
