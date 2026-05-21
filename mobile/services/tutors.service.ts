import { api } from '../lib/api';
import type { Paginated, TutorProfile } from '../types/api.types';

export const tutorsService = {
  search: (params?: {
    subject?: string; minRating?: string;
    maxHourlyRate?: string; page?: string; limit?: string;
  }) =>
    api.get('/tutors/search', { params }).then((r) => {
      const d = r.data?.data;
      const items: TutorProfile[] = Array.isArray(d) ? d : (d?.items ?? []);
      return {
        items, total: d?.total ?? items.length, page: d?.page ?? 1,
        limit: d?.limit ?? items.length, totalPages: d?.totalPages ?? 1,
      } as Paginated<TutorProfile>;
    }),

  getByPublicId: (tutorPublicId: string): Promise<TutorProfile> =>
    api.get(`/tutors/${tutorPublicId}`).then((r) => r.data.data),
};
