import { z } from 'zod';

export const createTutorProfileSchema = z.object({
  subjects: z.array(z.string().min(1)).min(1, 'At least one subject is required'),
  languages: z.array(z.string().min(1)).min(1, 'At least one language is required'),
  hourlyRateCents: z.number().int().min(0).optional(),
  bio: z.string().max(1000).optional(),
  qualifications: z.array(z.string()).optional(),
  timezone: z.string().optional(),
});

export const updateTutorProfileSchema = z.object({
  subjects: z.array(z.string().min(1)).optional(),
  languages: z.array(z.string().min(1)).optional(),
  hourlyRateCents: z.number().int().min(0).optional(),
  bio: z.string().max(1000).optional(),
  qualifications: z.array(z.string()).optional(),
  timezone: z.string().optional(),
});

export const inviteTutorSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  subjects: z.array(z.string().min(1)).optional(),
  languages: z.array(z.string().min(1)).optional(),
});

export const tutorSearchSchema = z.object({
  subject: z.string().optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  maxHourlyRateCents: z.coerce.number().int().min(0).optional(),
  isVerified: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type CreateTutorProfileDto = z.infer<typeof createTutorProfileSchema>;
export type UpdateTutorProfileDto = z.infer<typeof updateTutorProfileSchema>;
export type InviteTutorDto = z.infer<typeof inviteTutorSchema>;
export type TutorSearchQuery = z.infer<typeof tutorSearchSchema>;
