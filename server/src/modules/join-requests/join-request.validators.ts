import { z } from 'zod';

export const createTutorRequestSchema = z.object({
  principalProfilePublicId: z.string().min(1),
  message: z.string().max(500).optional(),
});

export const createPrincipalRequestSchema = z.object({
  query: z.string().min(1, 'Email or phone is required'),
  message: z.string().max(500).optional(),
});

export const rejectRequestSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type CreateTutorRequestDto = z.infer<typeof createTutorRequestSchema>;
export type CreatePrincipalRequestDto = z.infer<typeof createPrincipalRequestSchema>;
export type RejectRequestDto = z.infer<typeof rejectRequestSchema>;
