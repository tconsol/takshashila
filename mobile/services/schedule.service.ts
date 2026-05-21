import { api } from '../lib/api';
import type { TutorSlot } from '../types/api.types';

export const scheduleService = {
  getTutorAvailability: (
    tutorId: string,
    params?: { from?: string; to?: string },
  ): Promise<TutorSlot[]> =>
    api.get(`/schedules/availability/${tutorId}`, { params }).then((r) => {
      const d = r.data?.data;
      if (Array.isArray(d)) return d;
      if (Array.isArray(d?.items)) return d.items;
      if (Array.isArray(d?.slots)) return d.slots;
      return [];
    }),
};
