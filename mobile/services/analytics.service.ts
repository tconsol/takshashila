import { api } from '../lib/api';
import type { StudentAnalytics } from '../types/api.types';

export const analyticsService = {
  getStudentMe: (): Promise<StudentAnalytics> =>
    api.get('/analytics/student/me').then((r) => r.data?.data ?? {
      upcoming: 0, completed: 0, submissions: 0, attendanceRate: 0,
    }),
};
