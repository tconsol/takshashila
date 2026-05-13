import { api } from '../lib/axios';

// Maps raw API response (startUTC/endUTC/title) to the frontend ClassRecord shape
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
    api.post('/classes/book', dto).then((r) => mapClass(r.data.data)),

  getMyAsTutor: (params?: Record<string, string>) =>
    api.get('/classes/my/tutor', { params }).then((r) => ({
      ...r.data.data,
      items: (r.data.data?.items ?? []).map(mapClass),
    } as PaginatedClasses)),

  getMyAsStudent: (params?: Record<string, string>) =>
    api.get('/classes/my/student', { params }).then((r) => ({
      ...r.data.data,
      items: (r.data.data?.items ?? []).map(mapClass),
    } as PaginatedClasses)),

  getById: (classId: string) =>
    api.get(`/classes/${classId}`).then((r) => mapClass(r.data.data)),

  start: (classId: string) =>
    api.post(`/classes/${classId}/start`).then((r) => mapClass(r.data.data)),

  complete: (classId: string) =>
    api.post(`/classes/${classId}/complete`).then((r) => mapClass(r.data.data)),

  cancel: (classId: string, dto: CancelClassDto) =>
    api.post(`/classes/${classId}/cancel`, dto).then((r) => mapClass(r.data.data)),

  setMeetingUrl: (classId: string, meetingUrl: string) =>
    api.patch(`/classes/${classId}/meeting-url`, { meetingUrl }).then((r) => mapClass(r.data.data)),
};

