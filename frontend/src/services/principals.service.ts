import { api } from '../lib/axios';

export interface PrincipalProfile {
  publicId: string;
  userPublicId: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  organizationName?: string;
  organizationWebsite?: string;
  bio?: string;
  commissionRatePercent: number;
  totalTutors: number;
  totalStudents: number;
  totalRevenueCents: number;
  trustScore: number;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedPrincipals {
  items: PrincipalProfile[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const principalsService = {
  getMyProfile: () =>
    api.get<{ data: PrincipalProfile }>('/principals/me').then((r) => r.data.data),

  getByPublicId: (publicId: string) =>
    api.get<{ data: PrincipalProfile }>(`/principals/${publicId}`).then((r) => r.data.data),

  listAll: (params?: Record<string, string>) =>
    api
      .get<{ data: PaginatedPrincipals }>('/principals', { params })
      .then((r) => r.data.data),

  listPending: (params?: Record<string, string>) =>
    api
      .get<{ data: PaginatedPrincipals }>('/principals/pending', { params })
      .then((r) => r.data.data),

  approve: (publicId: string) =>
    api.post<{ data: PrincipalProfile }>(`/principals/${publicId}/approve`).then((r) => r.data.data),

  suspend: (publicId: string) =>
    api.post<{ data: PrincipalProfile }>(`/principals/${publicId}/suspend`).then((r) => r.data.data),
};
