// frontend/src/services/programs.service.ts
import { api } from '../lib/axios';
import type { AvailabilityWindow } from './courses.service';
import type { ProgressClass, StructureTopic } from './courses.service';

export interface ProgramModule { publicId: string; title: string; description?: string; order: number }

export interface Program {
  publicId: string;
  tutorPublicId: string;
  tutorName: string;
  title: string;
  category: string;
  description?: string;
  level: string;
  ageMin?: number;
  ageMax?: number;
  sessionCount: number;
  sessionMinutes: number;
  priceCents: number;
  maxEnrollees?: number;
  activeEnrollmentCount: number;
  isFull: boolean;
  modules: ProgramModule[];
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: string;
}

export interface ProgramInput {
  title: string;
  category: string;
  description?: string;
  level: string;
  ageMin?: number;
  ageMax?: number;
  sessionCount: number;
  sessionMinutes: number;
  priceCents: number;
  maxEnrollees?: number;
  modules: Array<{ publicId?: string; title: string; description?: string }>;
}

export interface Enrollment {
  publicId: string;
  programPublicId: string;
  programTitle: string;
  programCategory: string;
  tutorName: string;
  studentName: string;
  sessionCount: number;
  sessionsScheduledCount: number;
  sessionsCompletedCount: number;
  priceCentsPaid: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  availabilityWindow: AvailabilityWindow;
  createdAt: string;
}

export interface EnrollmentStructure {
  viewerRole: 'STUDENT' | 'PARENT' | 'TUTOR' | 'ADMIN';
  enrollment: {
    publicId: string; status: Enrollment['status']; sessionCount: number; sessionsScheduledCount: number;
    sessionsCompletedCount: number; availabilityWindow: AvailabilityWindow; tutorName: string; studentName: string;
  };
  program: { publicId: string; title: string; category: string; level: string; sessionMinutes: number; modules: ProgramModule[] };
  topics: StructureTopic[];
  otherClasses: ProgressClass[];
}

export interface PaginatedPrograms { items: Program[]; total: number; page: number; limit: number; totalPages: number }

export const programsService = {
  catalog: (params: Record<string, string>): Promise<PaginatedPrograms> => api.get('/programs', { params }).then((r) => r.data.data),
  mine: (): Promise<Program[]> => api.get('/programs/mine').then((r) => r.data.data),
  get: (id: string): Promise<Program> => api.get(`/programs/${id}`).then((r) => r.data.data),
  create: (dto: ProgramInput): Promise<Program> => api.post('/programs', dto).then((r) => r.data.data),
  update: (id: string, dto: Partial<ProgramInput>): Promise<Program> => api.put(`/programs/${id}`, dto).then((r) => r.data.data),
  setStatus: (id: string, action: 'publish' | 'archive'): Promise<Program> => api.post(`/programs/${id}/${action}`).then((r) => r.data.data),
  remove: (id: string): Promise<void> => api.delete(`/programs/${id}`).then(() => undefined),
  enrollments: (id: string): Promise<Enrollment[]> => api.get(`/programs/${id}/enrollments`).then((r) => r.data.data),
  enroll: (id: string, availabilityWindow: AvailabilityWindow): Promise<Enrollment> =>
    api.post(`/programs/${id}/enroll`, { availabilityWindow }).then((r) => r.data.data),
  myEnrollments: (): Promise<Enrollment[]> => api.get('/programs/enrollments/mine').then((r) => r.data.data),
  childrenEnrollments: (): Promise<Enrollment[]> => api.get('/programs/enrollments/children').then((r) => r.data.data),
  structure: (enrollmentId: string): Promise<EnrollmentStructure> =>
    api.get(`/programs/enrollments/${enrollmentId}/structure`).then((r) => r.data.data),
  scheduleSession: (enrollmentId: string, dto: { startUTC: string; endUTC: string; title: string; programModulePublicId: string }) =>
    api.post(`/programs/enrollments/${enrollmentId}/sessions`, dto).then((r) => r.data.data),
  cancel: (enrollmentId: string): Promise<Enrollment> => api.post(`/programs/enrollments/${enrollmentId}/cancel`).then((r) => r.data.data),
  adminList: (params: Record<string, string>): Promise<PaginatedPrograms> => api.get('/programs/admin', { params }).then((r) => r.data.data),
  unpublish: (id: string): Promise<Program> => api.post(`/programs/${id}/unpublish`).then((r) => r.data.data),
};
