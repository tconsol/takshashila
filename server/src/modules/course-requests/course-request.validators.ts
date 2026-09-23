import { z } from 'zod';

export const createCourseRequestSchema = z.object({
  coursePublicId: z.string().min(1),
  selectedTopicPublicIds: z.array(z.string()).min(1, 'Select at least one topic'),
  tutorPublicId: z.string().min(1),
  availabilityWindow: z.object({
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
    startLocalTime: z.string().regex(/^\d{2}:\d{2}$/),
    endLocalTime: z.string().regex(/^\d{2}:\d{2}$/),
    ianaTimezone: z.string().min(1),
  }),
});

export const acceptCourseRequestSchema = z.object({
  classesRequired: z.number().int().min(1).max(200),
});

export const rejectCourseRequestSchema = z.object({
  reason: z.string().min(1).max(500),
});

export const scheduleCourseClassSchema = z.object({
  startUTC: z.string().datetime(),
  endUTC: z.string().datetime(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  courseTopicPublicId: z.string().optional(),
});

export type CreateCourseRequestDto = z.infer<typeof createCourseRequestSchema>;
export type AcceptCourseRequestDto = z.infer<typeof acceptCourseRequestSchema>;
export type RejectCourseRequestDto = z.infer<typeof rejectCourseRequestSchema>;
export type ScheduleCourseClassDto = z.infer<typeof scheduleCourseClassSchema>;
