import { api } from '../lib/axios';

export interface DemoRequest {
  publicId: string;
  studentPublicId: string;
  tutorPublicId: string;
  availabilitySlotPublicId: string;
  preferredSubject: string;
  message?: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  classPublicId?: string;
  rejectionReason?: string;
  slotStartUTC?: string;
  slotEndUTC?: string;
  slotTimezone?: string;
  createdAt: string;
}

export interface CreateDemoRequestDto {
  tutorPublicId: string;
  availabilitySlotPublicId: string;
  preferredSubject: string;
  message?: string;
}

export interface PaginatedDemoRequests {
  items: DemoRequest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const demoRequestsService = {
  create: (dto: CreateDemoRequestDto): Promise<DemoRequest> =>
    api.post('/demo-requests', dto).then((r) => r.data.data),

  getMyAsTutor: (params?: Record<string, string>): Promise<PaginatedDemoRequests> =>
    api.get('/demo-requests/my/tutor', { params }).then((r) => r.data.data),

  getMyAsStudent: (params?: Record<string, string>): Promise<PaginatedDemoRequests> =>
    api.get('/demo-requests/my/student', { params }).then((r) => r.data.data),

  accept: (requestId: string): Promise<DemoRequest> =>
    api.post(`/demo-requests/${requestId}/accept`).then((r) => r.data.data),

  reject: (requestId: string, reason: string): Promise<DemoRequest> =>
    api.post(`/demo-requests/${requestId}/reject`, { reason }).then((r) => r.data.data),
};
