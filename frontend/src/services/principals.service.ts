import { api } from '../lib/axios';

export interface PrincipalProfile {
  publicId: string;
  userPublicId: string;
  displayName: string;
  status: string;
  isVerified: boolean;
  totalTutors: number;
  totalStudents: number;
  createdAt: string;
}

export const principalsService = {
  getMyProfile: () =>
    api.get<{ data: PrincipalProfile }>('/principals/me').then((r) => r.data.data),

  getByPublicId: (publicId: string) =>
    api.get<{ data: PrincipalProfile }>(`/principals/${publicId}`).then((r) => r.data.data),

  listAll: (params?: Record<string, string>) =>
    api.get<{ data: { items: PrincipalProfile[]; total: number; page: number; limit: number; totalPages: number } }>(
      '/principals',
      { params },
    ).then((r) => r.data.data),

  listPending: (params?: Record<string, string>) =>
    api.get<{ data: { items: PrincipalProfile[]; total: number; page: number; limit: number; totalPages: number } }>(
      '/principals/pending',
      { params },
    ).then((r) => r.data.data),

  approve: (publicId: string) =>
    api.post<{ data: PrincipalProfile }>(`/principals/${publicId}/approve`).then((r) => r.data.data),

  suspend: (publicId: string) =>
    api.post<{ data: PrincipalProfile }>(`/principals/${publicId}/suspend`).then((r) => r.data.data),
};

