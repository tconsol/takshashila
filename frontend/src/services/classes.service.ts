import { api, API_BASE } from '../lib/axios';
import { useAuthStore } from '../stores/auth.store';

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
    meetingProvider: raw.meetingProvider,
    costCents: raw.costCents ?? 0,
    notes: raw.notes ?? raw.description,
    isRefunded: raw.isRefunded ?? false,
    studentJoinedAt: raw.studentJoinedAt,
    groupPublicId: raw.groupPublicId,
    durationMinutes: raw.durationMinutes,
    billingMode: raw.billingMode,
    refundedAt: raw.refundedAt,
    tutorName: raw.tutorName,
    studentName: raw.studentName,
    autoResolution: raw.autoResolution,
    attendedMinutes: raw.attendedMinutes,
    requiredMinutes: raw.requiredMinutes,
    studentLeftEarly: raw.studentLeftEarly,
    requestStatus: raw.requestStatus,
    seriesPublicId: raw.seriesPublicId,
    pricePerHourCents: raw.pricePerHourCents,
    fundedThrough: raw.fundedThrough,
    autoResolvedAt: raw.autoResolvedAt,
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

export interface CancelClassDto {
  reason: string;
}

export interface TutorCreateClassDto {
  title: string;
  description?: string;
  classType: 'DEMO' | 'ONE_ON_ONE' | 'GROUP' | 'RECURRING';
  startUTC: string;
  endUTC: string;
  recurrence: 'NONE' | 'DAILY' | 'WEEKLY';
  recurrenceEndDate?: string;
  studentPublicIds: string[];
  meetingUrl?: string;
  meetingProvider?: 'zoom' | 'google_meet' | 'native';
  /** Price per student per hour, in cents. Defaults to the tutor's own rate on the server. */
  pricePerHourCents?: number;
}

export interface TutorRescheduleDto {
  startUTC: string;
  endUTC: string;
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
  meetingProvider?: 'zoom' | 'google_meet' | 'native';
  costCents: number;
  notes?: string;
  isRefunded?: boolean;
  studentJoinedAt?: string;
  /** Shared by the records (one per student) of one group session. */
  groupPublicId?: string;
  durationMinutes?: number;
  billingMode?: string;
  refundedAt?: string;
  /** Resolved server-side so a list can name the other party in the class. */
  tutorName?: string;
  studentName?: string;
  /** Set when the grace-period sweep closed this class instead of a person. */
  autoResolution?: 'AUTO_COMPLETED' | 'AUTO_CANCELLED';
  autoResolvedAt?: string;
  /** Minutes each person was present, kept once the class has been settled by attendance. */
  attendedMinutes?: { tutor: number; student: number };
  /** Minutes each person had to attend. */
  requiredMinutes?: number;
  /** Billed as completed although this student did not attend the required share. */
  studentLeftEarly?: boolean;
  /** Tutor-created classes: whether the student has accepted. Absent for classes that never needed it. */
  requestStatus?: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  /** Every session and student of one tutor request share this. */
  seriesPublicId?: string;
  pricePerHourCents?: number;
  /** Sessions starting before this are covered by the student's funded block. */
  fundedThrough?: string;
  createdAt: string;
}

export interface PaginatedClasses {
  items: ClassRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * The API nests counts under `pagination`; this type exposes them flat. Callers
 * read `.total` to drive tab indicators, so the lift has to happen here — a
 * spread of the raw body leaves `total` undefined and every indicator dead.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPage(raw: any): PaginatedClasses {
  const pagination = raw?.pagination ?? {};
  return {
    items: (raw?.items ?? []).map(mapClass),
    total: pagination.total ?? 0,
    page: pagination.page ?? 1,
    limit: pagination.limit ?? 0,
    totalPages: pagination.totalPages ?? 0,
  };
}

/** How long a person has been present in a live class against what the class needs. */
export interface PresenceProgress {
  attendedMinutes: number;
  requiredMinutes: number;
}

export const classesService = {
  /** Heartbeat from the room page: "I am here now". Returns this person's progress, or null once the class is closed. */
  presence: (classId: string): Promise<PresenceProgress | null> =>
    api.post(`/classes/${classId}/presence`).then((r) => r.data.data ?? null),

  /**
   * Last heartbeat as the page goes away (tab or window closed). A plain request can be
   * cancelled mid-unload, so this uses fetch with keepalive, which the browser lets finish.
   */
  sendLeave: (classId: string): void => {
    const token = useAuthStore.getState().accessToken;
    void fetch(`${API_BASE}/classes/${classId}/leave`, {
      method: 'POST',
      keepalive: true,
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => {});
  },

  book: (dto: BookClassDto) =>
    api.post('/classes/book', dto).then((r) => mapClass(r.data.data)),

  getMyAsTutor: (params?: Record<string, string>) =>
    api.get('/classes/my/tutor', { params }).then((r) => mapPage(r.data.data)),

  getMyAsStudent: (params?: Record<string, string>) =>
    api.get('/classes/my/student', { params }).then((r) => mapPage(r.data.data)),

  getMyAsPrincipal: (params?: Record<string, string>) =>
    api.get('/classes/my/principal', { params }).then((r) => mapPage(r.data.data)),

  getById: (classId: string) =>
    api.get(`/classes/${classId}`).then((r) => mapClass(r.data.data)),

  join: (classId: string) =>
    api.post(`/classes/${classId}/join`).then((r) => mapClass(r.data.data)),

  start: (classId: string) =>
    api.post(`/classes/${classId}/start`).then((r) => mapClass(r.data.data)),

  complete: (classId: string) =>
    api.post(`/classes/${classId}/complete`).then((r) => mapClass(r.data.data)),

  cancel: (classId: string, dto: CancelClassDto) =>
    api.post(`/classes/${classId}/cancel`, dto).then((r) => mapClass(r.data.data)),

  refund: (classId: string, reason: string) =>
    api.post(`/classes/${classId}/refund`, { reason }).then((r) => mapClass(r.data.data)),

  setMeetingUrl: (classId: string, meetingUrl: string) =>
    api.patch(`/classes/${classId}/meeting-url`, { meetingUrl }).then((r) => mapClass(r.data.data)),

  getAgoraToken: (classId: string): Promise<{ appId: string; channel: string; token: string; uid: number; canPublish?: boolean }> =>
    api.get(`/classes/${classId}/agora-token`).then((r) => r.data.data),

  /** The student's answer to a tutor's class request; it covers their whole series. */
  accept: (classId: string) =>
    api.post(`/classes/${classId}/accept`).then((r) => r.data.data as { accepted: number; fundedThrough?: string }),

  decline: (classId: string) =>
    api.post(`/classes/${classId}/decline`).then((r) => r.data.data as { accepted: number }),

  tutorCreate: (dto: TutorCreateClassDto) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api.post('/classes/tutor/create', dto).then((r) => (r.data.data as any[]).map(mapClass)),

  tutorReschedule: (classId: string, dto: TutorRescheduleDto) =>
    api.patch(`/classes/${classId}/reschedule-by-tutor`, dto).then((r) => mapClass(r.data.data)),
};

