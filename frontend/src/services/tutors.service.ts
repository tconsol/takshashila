import { api } from '../lib/axios';

export interface TutorProfile {
  publicId: string;
  userPublicId: string;
  displayName: string;
  email?: string;
  bio?: string;
  subjects: string[];
  languages?: string[];
  hourlyRateCents?: number;
  status: string;
  isVerified: boolean;
  rating: number;
  totalStudents: number;
  totalClassesCompleted: number;
  commissionRatePercent: number;
  trustScore: number;
  principalPublicId?: string;
  createdAt: string;
}

export interface TutorSearchFilters {
  subject?: string;
  minRating?: number;
  maxHourlyRate?: number;
  page?: number;
  limit?: number;
}

interface PaginatedTutors {
  items: TutorProfile[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface MyPrincipal {
  publicId: string;
  userPublicId: string;
  organizationName?: string;
  organizationWebsite?: string;
  bio?: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  commissionRatePercent: number;
  totalTutors: number;
  totalStudents: number;
  createdAt: string;
}

export const tutorsService = {
  getMyProfile: () =>
    api.get<{ data: TutorProfile }>('/tutors/me').then((r) => r.data.data),

  getMyPrincipal: () =>
    api.get<{ data: MyPrincipal | null }>('/tutors/my-principal').then((r) => r.data.data),

  invite: (payload: { email: string; firstName: string; lastName: string; subjects: string[]; hourlyRateCents?: number }) =>
    api.post<{ data: TutorProfile }>('/tutors/invite', payload).then((r) => r.data.data),

  getByPublicId: (publicId: string) =>
    api.get<{ data: TutorProfile }>(`/tutors/${publicId}`).then((r) => r.data.data),

  search: (filters?: TutorSearchFilters) =>
    api
      .get<{ data: PaginatedTutors }>('/tutors/search', { params: filters })
      .then((r) => r.data.data),

  listMyTutors: (params?: Record<string, string>) =>
    api
      .get<{ data: PaginatedTutors }>('/tutors/my-tutors', { params })
      .then((r) => r.data.data),

  listPending: () =>
    api
      .get<{ data: PaginatedTutors }>('/tutors/pending')
      .then((r) => r.data.data),

  approve: (publicId: string) =>
    api.post<{ data: TutorProfile }>(`/tutors/${publicId}/approve`).then((r) => r.data.data),

  suspend: (publicId: string, reason: string) =>
    api.post<{ data: TutorProfile }>(`/tutors/${publicId}/suspend`, { reason }).then((r) => r.data.data),
};
