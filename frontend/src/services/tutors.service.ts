import { api } from '../lib/axios';

export interface TutorProfile {
  publicId: string;
  userPublicId: string;
  displayName: string;
  bio?: string;
  subjects: string[];
  status: string;
  isVerified: boolean;
  rating: number;
  totalStudents: number;
  totalClassesCompleted: number;
  commissionRatePercent: number;
  trustScore: number;
  createdAt: string;
}

export interface TutorSearchFilters {
  subject?: string;
  minRating?: number;
  maxHourlyRate?: number;
  page?: number;
  limit?: number;
}

export const tutorsService = {
  getMyProfile: () =>
    api.get<{ data: TutorProfile }>('/tutors/me').then((r) => r.data.data),

  invite: (payload: { email: string; firstName: string; lastName: string; subjects: string[]; hourlyRateCents?: number }) =>
    api.post<{ data: TutorProfile }>('/tutors/invite', payload).then((r) => r.data.data),

  getByPublicId: (publicId: string) =>
    api.get<{ data: TutorProfile }>(`/tutors/${publicId}`).then((r) => r.data.data),

  search: (filters?: TutorSearchFilters) =>
    api.get<{ data: { items: TutorProfile[]; total: number; page: number; limit: number; totalPages: number } }>(
      '/tutors/search',
      { params: filters },
    ).then((r) => r.data.data),

  approve: (publicId: string) =>
    api.post<{ data: TutorProfile }>(`/tutors/${publicId}/approve`).then((r) => r.data.data),

  suspend: (publicId: string, reason: string) =>
    api.post<{ data: TutorProfile }>(`/tutors/${publicId}/suspend`, { reason }).then((r) => r.data.data),

  listPending: () =>
    api.get<{ data: { items: TutorProfile[]; total: number } }>('/tutors/pending')
      .then((r) => r.data.data.items),
};

