import { z } from 'zod';

export const createCourseSchema = z.object({
  curriculumPublicId: z.string().min(1),
  topicPublicIds: z.array(z.string()).min(1, 'Select at least one topic'),
  tutorPublicId: z.string().min(1),
  availabilityWindow: z.object({
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
    startLocalTime: z.string().regex(/^\d{2}:\d{2}$/),
    endLocalTime: z.string().regex(/^\d{2}:\d{2}$/),
    ianaTimezone: z.string().min(1),
  }),
});

export const acceptCourseSchema = z.object({
  classesRequired: z.number().int().min(1).max(200),
});

export const rejectCourseSchema = z.object({
  reason: z.string().min(1).max(500),
});

export const scheduleCourseClassSchema = z.object({
  startUTC: z.string().datetime(),
  endUTC: z.string().datetime(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  // Required for course classes: the student's progress page marks topics done from
  // their classes. Ordinary 1:1 classes are scheduled elsewhere and stay topic-free.
  topicPublicId: z.string().min(1, 'Select the topic this class covers'),
});

export type CreateCourseDto = z.infer<typeof createCourseSchema>;
export type AcceptCourseDto = z.infer<typeof acceptCourseSchema>;
export type RejectCourseDto = z.infer<typeof rejectCourseSchema>;
export type ScheduleCourseClassDto = z.infer<typeof scheduleCourseClassSchema>;
