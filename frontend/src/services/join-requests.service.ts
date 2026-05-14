import { api } from '../lib/axios';

export interface JoinRequest {
  publicId: string;
  tutorUserPublicId: string;
  tutorProfilePublicId: string;
  principalUserPublicId: string;
  principalProfilePublicId: string;
  initiatedBy: 'TUTOR' | 'PRINCIPAL';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  message?: string;
  rejectionReason?: string;
  createdAt: string;
  tutorName: string;
  tutorEmail: string;
  tutorSubjects: string[];
  principalName: string;
  principalOrg: string;
  principalEmail: string;
}

export interface TutorSearchResult {
  userPublicId: string;
  tutorProfilePublicId: string;
  displayName: string;
  email: string;
  phone?: string;
  subjects: string[];
  status: string;
  principalPublicId?: string;
}

export interface ActivePrincipal {
  publicId: string;
  userPublicId: string;
  organizationName?: string;
  bio?: string;
  totalTutors: number;
  totalStudents: number;
  status: string;
  firstName: string;
  lastName: string;
  email: string;
}

export const joinRequestsService = {
  sendTutorRequest: (principalProfilePublicId: string, message?: string) =>
    api.post('/join-requests/tutor-request', { principalProfilePublicId, message })
      .then((r) => r.data.data as JoinRequest),

  sendPrincipalRequest: (query: string, message?: string) =>
    api.post('/join-requests/principal-request', { query, message })
      .then((r) => r.data.data as JoinRequest),

  listIncoming: () =>
    api.get('/join-requests/incoming').then((r) => r.data.data as JoinRequest[]),

  listOutgoing: () =>
    api.get('/join-requests/outgoing').then((r) => r.data.data as JoinRequest[]),

  approve: (publicId: string) =>
    api.post(`/join-requests/${publicId}/approve`).then((r) => r.data.data as JoinRequest),

  reject: (publicId: string, reason?: string) =>
    api.post(`/join-requests/${publicId}/reject`, { reason }).then((r) => r.data.data as JoinRequest),

  cancel: (publicId: string) =>
    api.post(`/join-requests/${publicId}/cancel`),

  searchTutor: (q: string) =>
    api.get('/join-requests/search-tutor', { params: { q } })
      .then((r) => r.data.data as TutorSearchResult | null),

  listActivePrincipals: (params?: { page?: number; limit?: number }) =>
    api.get('/principals/active', { params })
      .then((r) => r.data.data as { items: ActivePrincipal[]; pagination: { total: number; totalPages: number; page: number; limit: number } }),
};
