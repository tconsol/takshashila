import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/axios';

export interface IRating {
  publicId: string;
  classPublicId: string;
  raterPublicId: string;
  tutorPublicId: string;
  score: number;
  comment?: string;
  createdAt: string;
}

const ratingKeys = {
  tutor: (id: string) => ['ratings', 'tutor', id] as const,
  mine: (classId: string) => ['ratings', 'mine', classId] as const,
};

export function useTutorRatings(tutorPublicId: string) {
  return useQuery({
    queryKey: ratingKeys.tutor(tutorPublicId),
    queryFn: async () => {
      const { data } = await api.get(`/ratings/tutor/${tutorPublicId}`);
      return data;
    },
    enabled: !!tutorPublicId,
  });
}

export function useMyClassRating(classPublicId: string | null) {
  return useQuery<IRating | null>({
    queryKey: ratingKeys.mine(classPublicId ?? ''),
    queryFn: async () => {
      const { data } = await api.get(`/ratings/class/${classPublicId}/mine`);
      return data;
    },
    enabled: !!classPublicId,
  });
}

export function useMyRatedClassIds() {
  return useQuery<string[]>({
    queryKey: ['ratings', 'my-class-ids'],
    queryFn: async () => {
      const { data } = await api.get('/ratings/my-class-ids');
      return data;
    },
  });
}

export function useSubmitRating() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: { classPublicId: string; score: number; comment?: string }) => {
      const { data } = await api.post('/ratings', dto);
      return data as IRating;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ratingKeys.mine(vars.classPublicId) });
    },
  });
}
