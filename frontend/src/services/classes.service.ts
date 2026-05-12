import { api } from '../lib/axios';

export interface BookClassDto {
  tutorPublicId: string;
  slotPublicId: string;
  classType: 'DEMO' | 'REGULAR' | 'INTENSIVE';
  subject: string;
  notes?: string;
}

export interface CancelClassDto {
  reason: string;
}

export interface ClassRecord {
  publicId: string;
  tutorPublicId: string;
  studentPublicId: string;
  slotPublicId: string;
  status: string;
  classType: string;
  subject: string;
  scheduledStartUTC: string;
  scheduledEndUTC: string;
  meetingUrl?: string;
  costCents: number;
  notes?: string;
  createdAt: string;
}

export interface PaginatedClasses {
  items: ClassRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const classesService = {
  book: (dto: BookClassDto) =>
    api.post<{ data: ClassRecord }>('/classes/book', dto).then((r) => r.data.data),

  getMyAsTutor: (params?: Record<string, string>) =>
    api.get<{ data: PaginatedClasses }>('/classes/my/tutor', { params }).then((r) => r.data.data),

  getMyAsStudent: (params?: Record<string, string>) =>
    api.get<{ data: PaginatedClasses }>('/classes/my/student', { params }).then((r) => r.data.data),

  getById: (classId: string) =>
    api.get<{ data: ClassRecord }>(`/classes/${classId}`).then((r) => r.data.data),

  start: (classId: string) =>
    api.post<{ data: ClassRecord }>(`/classes/${classId}/start`).then((r) => r.data.data),

  complete: (classId: string) =>
    api.post<{ data: ClassRecord }>(`/classes/${classId}/complete`).then((r) => r.data.data),

  cancel: (classId: string, dto: CancelClassDto) =>
    api.post<{ data: ClassRecord }>(`/classes/${classId}/cancel`, dto).then((r) => r.data.data),

  setMeetingUrl: (classId: string, meetingUrl: string) =>
    api.patch<{ data: ClassRecord }>(`/classes/${classId}/meeting-url`, { meetingUrl }).then((r) => r.data.data),
};

