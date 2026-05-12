import { api } from '../lib/axios';

export interface StudentProfile {
  publicId: string;
  userPublicId: string;
  displayName: string;
  status: string;
  grade?: string;
  subjects: string[];
  demoClassesUsed: number;
  totalClassesAttended: number;
  totalClassesMissed: number;
  attendanceRate: number;
  createdAt: string;
}

export const studentsService = {
  getMyProfile: () =>
    api.get<{ data: StudentProfile }>('/students/me').then((r) => r.data.data),

  getByPublicId: (publicId: string) =>
    api.get<{ data: StudentProfile }>(`/students/${publicId}`).then((r) => r.data.data),

  approve: (publicId: string) =>
    api.post<{ data: StudentProfile }>(`/students/${publicId}/approve`).then((r) => r.data.data),

  suspend: (publicId: string, reason: string) =>
    api.post<{ data: StudentProfile }>(`/students/${publicId}/suspend`, { reason }).then((r) => r.data.data),

  listPending: () =>
    api.get<{ data: StudentProfile[] }>('/students/pending').then((r) => r.data.data),

  listAll: (params?: Record<string, string>) =>
    api.get<{ data: { items: StudentProfile[]; total: number; page: number; limit: number; totalPages: number } }>(
      '/students',
      { params },
    ).then((r) => r.data.data),
};

