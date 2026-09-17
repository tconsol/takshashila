import { api } from '../lib/axios';

export interface AvailabilitySlot {
  publicId: string;
  tutorPublicId: string;
  startUTC: string;
  endUTC: string;
  status: 'AVAILABLE' | 'BOOKED' | 'BLOCKED' | 'CANCELLED';
  timezone: string;
  recurrenceRule?: string;
  durationMinutes?: number;
  /** True for every occurrence of a repeating series. */
  isRecurring?: boolean;
  /** Shared by all occurrences created from one rule. */
  recurringRuleId?: string;
  createdAt: string;
}

export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY';

export interface Recurrence {
  frequency: RecurrenceFrequency;
  /** Total occurrences, counting the first. */
  count: number;
}

export interface CreateSlotDto {
  startUTC: string;
  endUTC: string;
  ianaTimezone: string;
  recurrenceRule?: string;
  isRecurring?: boolean;
  recurrence?: Recurrence;
}

export const schedulesService = {
  createSlot: (dto: CreateSlotDto) =>
    api.post<{ data: AvailabilitySlot }>('/schedules/slots', dto).then((r) => r.data.data),

  getMySlots: (params?: { from?: string; to?: string }) =>
    api.get('/schedules/slots/me', { params }).then((r) => (r.data.data?.items ?? r.data.data ?? []) as AvailabilitySlot[]),

  getTutorSlots: (tutorPublicId: string, params?: { from?: string; to?: string }) =>
    api.get<{ data: { items: AvailabilitySlot[]; total: number } }>(`/schedules/availability/${tutorPublicId}`, { params }).then((r) => r.data.data.items),

  deleteSlot: (slotPublicId: string) =>
    api.delete(`/schedules/slots/${slotPublicId}`),

  cancelSlot: (slotPublicId: string) =>
    api.patch<{ data: AvailabilitySlot }>(`/schedules/slots/${slotPublicId}/cancel`).then((r) => r.data.data),

  rescheduleSlot: (slotPublicId: string, dto: { startUTC: string; endUTC: string }) =>
    api.patch<{ data: AvailabilitySlot }>(`/schedules/slots/${slotPublicId}/reschedule`, dto).then((r) => r.data.data),
};

