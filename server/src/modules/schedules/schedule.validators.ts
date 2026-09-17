import { z } from 'zod';

/** How a repeating slot repeats. `count` includes the first occurrence. */
export const recurrenceSchema = z.object({
  frequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY']),
  // Capped so one submission cannot fill a tutor's calendar for a year.
  count: z.coerce.number().int().min(2).max(52),
});

export type RecurrenceDto = z.infer<typeof recurrenceSchema>;

export const createAvailabilitySlotSchema = z.object({
  startUTC: z.string().datetime({ message: 'startUTC must be ISO8601 UTC datetime' }),
  endUTC: z.string().datetime({ message: 'endUTC must be ISO8601 UTC datetime' }),
  ianaTimezone: z.string().min(1),
  isRecurring: z.boolean().optional().default(false),
  recurrence: recurrenceSchema.optional(),
}).refine((d) => !d.isRecurring || !!d.recurrence, {
  message: 'A recurring slot needs a recurrence rule',
  path: ['recurrence'],
}).refine((d) => new Date(d.endUTC) > new Date(d.startUTC), {
  message: 'endUTC must be after startUTC',
  path: ['endUTC'],
}).refine((d) => {
  const durationMs = new Date(d.endUTC).getTime() - new Date(d.startUTC).getTime();
  return durationMs >= 30 * 60 * 1000;
}, {
  message: 'Slot must be at least 30 minutes',
  path: ['endUTC'],
});

export const getAvailabilityQuerySchema = z.object({
  tutorPublicId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const rescheduleSlotSchema = z.object({
  startUTC: z.string().datetime({ message: 'startUTC must be ISO8601 UTC datetime' }),
  endUTC: z.string().datetime({ message: 'endUTC must be ISO8601 UTC datetime' }),
}).refine((d) => new Date(d.endUTC) > new Date(d.startUTC), {
  message: 'endUTC must be after startUTC',
  path: ['endUTC'],
}).refine((d) => {
  const durationMs = new Date(d.endUTC).getTime() - new Date(d.startUTC).getTime();
  return durationMs >= 30 * 60 * 1000;
}, {
  message: 'Slot must be at least 30 minutes',
  path: ['endUTC'],
});

export type CreateAvailabilitySlotDto = z.infer<typeof createAvailabilitySlotSchema>;
export type RescheduleSlotDto = z.infer<typeof rescheduleSlotSchema>;
export type GetAvailabilityQuery = z.infer<typeof getAvailabilityQuerySchema>;
