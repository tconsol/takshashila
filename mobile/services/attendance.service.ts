import { api } from '../lib/api';
import type { AttendanceRecord, Paginated } from '../types/api.types';

export const attendanceService = {
  getMyHistory: (params?: { limit?: string; page?: string }) =>
    api.get('/attendance/my', { params }).then((r) => {
      const d = r.data?.data;
      const items: AttendanceRecord[] = Array.isArray(d) ? d : (d?.items ?? []);
      return {
        items, total: d?.total ?? items.length, page: d?.page ?? 1,
        limit: d?.limit ?? items.length, totalPages: d?.totalPages ?? 1,
      } as Paginated<AttendanceRecord>;
    }),
};
