import { z } from 'zod';

export const bookClassSchema = z.object({
  tutorPublicId: z.string().min(1),
  availabilitySlotPublicId: z.string().min(1),
  classType: z.enum(['DEMO', 'ONE_ON_ONE', 'GROUP', 'RECURRING']),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  idempotencyKey: z.string().min(1),
});

export const cancelClassSchema = z.object({
  reason: z.string().min(1).max(500),
});

export const rescheduleClassSchema = z.object({
  newSlotPublicId: z.string().min(1),
  reason: z.string().max(500).optional(),
  idempotencyKey: z.string().min(1),
});

export const setMeetingUrlSchema = z.object({
  meetingUrl: z.string().url(),
  meetingProvider: z.enum(['zoom', 'google_meet']),
  meetingId: z.string().optional(),
});

export const classQuerySchema = z.object({
  status: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  classType: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type BookClassDto = z.infer<typeof bookClassSchema>;
export type CancelClassDto = z.infer<typeof cancelClassSchema>;
export type RescheduleClassDto = z.infer<typeof rescheduleClassSchema>;
export type SetMeetingUrlDto = z.infer<typeof setMeetingUrlSchema>;
