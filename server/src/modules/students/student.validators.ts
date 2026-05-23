import { z } from 'zod';

export const GRADE_LIST = [
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4',
  'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8',
  'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
] as const;

export type Grade = (typeof GRADE_LIST)[number];

export const createStudentByTutorSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName:  z.string().min(1, 'Last name is required').max(50),
  email:     z.string().email('Invalid email address'),
  phone:     z.string().optional(),
  password:  z.string().min(8, 'Password must be at least 8 characters'),
  grade:     z.enum(GRADE_LIST).optional(),
  notes:     z.string().max(2000).optional(),
});

export type CreateStudentByTutorDto = z.infer<typeof createStudentByTutorSchema>;

export const inviteExistingStudentSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(5).optional(),
}).refine((d) => d.email || d.phone, { message: 'Provide email or phone' });

export type InviteExistingStudentDto = z.infer<typeof inviteExistingStudentSchema>;
