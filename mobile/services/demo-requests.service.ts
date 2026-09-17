import { api } from '../lib/api';

export interface DemoRequest {
  publicId: string;
  tutorPublicId: string;
  studentPublicId: string;
  preferredSubject?: string;
  status: string;
  createdAt: string;
}

export const demoRequestsService = {
  // A student requests to join a tutor (a free demo). The tutor accepts → the
  // student becomes linked under that tutor.
  create: (dto: {
    tutorPublicId: string;
    availabilitySlotPublicId?: string;
    preferredSubject?: string;
    message?: string;
  }): Promise<DemoRequest> =>
    api.post('/demo-requests', dto).then((r) => r.data?.data ?? r.data),

  getMyAsStudent: (params?: Record<string, string>) =>
    api.get('/demo-requests/my/student', { params }).then((r) => {
      const d = r.data?.data;
      const items: DemoRequest[] = Array.isArray(d) ? d : d?.items ?? [];
      return { items };
    }),
};
