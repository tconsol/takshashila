import { api } from '../lib/axios';

export interface AvailabilitySlot {
  publicId: string;
  tutorPublicId: string;
  startUTC: string;
  endUTC: string;
  status: 'AVAILABLE' | 'BOOKED' | 'BLOCKED';
  timezone: string;
  recurrenceRule?: string;
  createdAt: string;
}

export interface CreateSlotDto {
  startUTC: string;
  endUTC: string;
  ianaTimezone: string;
  recurrenceRule?: string;
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
};

