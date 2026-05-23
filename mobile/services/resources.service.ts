import { api } from '../lib/api';
import type { Paginated, Resource } from '../types/api.types';

export const resourcesService = {
  getMyAsStudent: (params?: { limit?: string; page?: string }) =>
    api.get('/resources/student/me', { params }).then((r) => {
      const d = r.data?.data;
      const items: Resource[] = Array.isArray(d) ? d : (d?.items ?? []);
      return {
        items, total: d?.total ?? items.length, page: d?.page ?? 1,
        limit: d?.limit ?? items.length, totalPages: d?.totalPages ?? 1,
      } as Paginated<Resource>;
    }),

  getReadUrl: (resourceId: string): Promise<string> =>
    api.get(`/resources/${resourceId}/read-url`).then((r) => {
      const d = r.data?.data;
      return typeof d === 'string' ? d : (d?.url ?? d?.readUrl ?? '');
    }),
};
