import { z } from 'zod';

export const createDemoRequestSchema = z.object({
  tutorPublicId: z.string().min(1),
  availabilitySlotPublicId: z.string().min(1),
  preferredSubject: z.string().min(1).max(100),
  message: z.string().max(500).optional(),
});

export const rejectDemoRequestSchema = z.object({
  reason: z.string().min(1).max(500),
});

export type CreateDemoRequestDto = z.infer<typeof createDemoRequestSchema>;
export type RejectDemoRequestDto = z.infer<typeof rejectDemoRequestSchema>;
