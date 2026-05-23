import { api } from '../lib/api';
import type {
  Paginated, Worksheet, WorksheetSummary, WorksheetSubmission, WorksheetType,
} from '../types/api.types';

export const worksheetsService = {
  getMyAsStudent: (params?: { type?: WorksheetType; limit?: string; page?: string }) =>
    api.get('/worksheets/student/me', { params }).then((r) => {
      const d = r.data?.data;
      const items: WorksheetSummary[] = Array.isArray(d) ? d : (d?.items ?? []);
      return {
        items, total: d?.total ?? items.length, page: d?.page ?? 1,
        limit: d?.limit ?? items.length, totalPages: d?.totalPages ?? 1,
      } as Paginated<WorksheetSummary>;
    }),

  getById: (worksheetId: string): Promise<Worksheet> =>
    api.get(`/worksheets/${worksheetId}`).then((r) => r.data.data),

  getMySubmission: (worksheetId: string): Promise<WorksheetSubmission | null> =>
    api.get(`/worksheets/${worksheetId}/my-submission`).then((r) => r.data?.data ?? null),

  submit: (
    worksheetId: string,
    answers: number[],
    timeTakenSeconds?: number,
  ): Promise<WorksheetSubmission> =>
    api
      .post(`/worksheets/${worksheetId}/submit`, { answers, timeTakenSeconds })
      .then((r) => r.data.data),
};
