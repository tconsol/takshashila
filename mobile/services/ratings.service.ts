import { api } from '../lib/api';
import type { ClassRating } from '../types/api.types';

export const ratingsService = {
  getMyRatedClassIds: (): Promise<string[]> =>
    api.get('/ratings/my-class-ids').then((r) => {
      const d = r.data?.data;
      return Array.isArray(d) ? d : (d?.classIds ?? []);
    }),

  rateClass: (dto: { classPublicId: string; score: number; comment?: string }): Promise<ClassRating> =>
    api.post('/ratings', dto).then((r) => r.data.data),
};
