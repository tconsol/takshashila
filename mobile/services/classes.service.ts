import { api } from '../lib/api';
import type { ClassRecord, PaginatedClasses } from '../types/api.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapClass(raw: any): ClassRecord {
  return {
    publicId: raw.publicId,
    tutorPublicId: raw.tutorPublicId,
    studentPublicId: raw.studentPublicId,
    slotPublicId: raw.slotPublicId ?? raw.availabilitySlotPublicId ?? '',
    status: raw.status,
    classType: raw.classType,
    subject: raw.subject ?? raw.title ?? '',
    scheduledStartUTC: raw.scheduledStartUTC ?? raw.startUTC ?? '',
    scheduledEndUTC: raw.scheduledEndUTC ?? raw.endUTC ?? '',
    meetingUrl: raw.meetingUrl,
    costCents: raw.costCents ?? 0,
    notes: raw.notes ?? raw.description,
    createdAt: raw.createdAt,
  };
}

export interface BookClassDto {
  tutorPublicId: string;
  availabilitySlotPublicId: string;
  classType: 'ONE_ON_ONE' | 'GROUP' | 'RECURRING';
  title: string;
  description?: string;
  idempotencyKey: string;
}

export const classesService = {
  getMyAsStudent: (params?: Record<string, string>): Promise<PaginatedClasses> =>
    api.get('/classes/my/student', { params }).then((r) => ({
      ...r.data.data,
      items: (r.data.data?.items ?? []).map(mapClass),
    })),

  getById: (classId: string): Promise<ClassRecord> =>
    api.get(`/classes/${classId}`).then((r) => mapClass(r.data.data)),

  book: (dto: BookClassDto): Promise<ClassRecord> =>
    api.post('/classes/book', dto).then((r) => mapClass(r.data.data)),

  join: (classId: string): Promise<ClassRecord> =>
    api.post(`/classes/${classId}/join`).then((r) => mapClass(r.data.data)),

  cancel: (classId: string, reason: string): Promise<ClassRecord> =>
    api.post(`/classes/${classId}/cancel`, { reason }).then((r) => mapClass(r.data.data)),
};
