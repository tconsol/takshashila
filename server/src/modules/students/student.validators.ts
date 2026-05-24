import { z } from 'zod';

export const GRADE_LIST = [
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4',
  'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8',
  'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
] as const;

export type Grade = (typeof GRADE_LIST)[number];

export const createStudentByTutorSchema = z.object({
  firstName:       z.string().min(1, 'First name is required').max(50),
  lastName:        z.string().min(1, 'Last name is required').max(50),
  contactEmail:    z.string().email('Invalid email address').optional(),
  phone:           z.string().optional(),
  password:        z.string().min(8, 'Password must be at least 8 characters'),
  customStudentId: z.string().min(3).max(20).regex(/^[a-z0-9]+$/, 'Only lowercase letters and numbers').optional(),
  grade:           z.enum(GRADE_LIST).optional(),
  notes:           z.string().max(2000).optional(),
});

export type CreateStudentByTutorDto = z.infer<typeof createStudentByTutorSchema>;

// Lookup by studentId, contactEmail, or phone
export const studentLookupSchema = z.object({
  studentId: z.string().min(3).optional(),
  email:     z.string().email().optional(),
  phone:     z.string().min(5).optional(),
}).refine((d) => d.studentId || d.email || d.phone, { message: 'Provide student ID, email, or phone' });

export type StudentLookupDto = z.infer<typeof studentLookupSchema>;

// Legacy alias used by tutor invite-existing flow
export const inviteExistingStudentSchema = studentLookupSchema;
export type InviteExistingStudentDto = StudentLookupDto;

export const createStudentByPrincipalSchema = z.object({
  firstName:       z.string().min(1, 'First name is required').max(50),
  lastName:        z.string().min(1, 'Last name is required').max(50),
  contactEmail:    z.string().email('Invalid email address').optional(),
  phone:           z.string().optional(),
  password:        z.string().min(8, 'Password must be at least 8 characters'),
  tutorPublicId:   z.string().min(1, 'Tutor is required'),
  customStudentId: z.string().min(3).max(20).regex(/^[a-z0-9]+$/, 'Only lowercase letters and numbers').optional(),
  grade:           z.enum(GRADE_LIST).optional(),
  notes:           z.string().max(2000).optional(),
});

export type CreateStudentByPrincipalDto = z.infer<typeof createStudentByPrincipalSchema>;

export const inviteStudentByPrincipalSchema = z.object({
  studentId:        z.string().min(3).optional(),
  studentPublicId:  z.string().uuid().optional(),
  email:            z.string().email().optional(),
  phone:            z.string().min(5).optional(),
  tutorPublicId:    z.string().min(1, 'Tutor is required'),
}).refine((d) => d.studentId || d.studentPublicId || d.email || d.phone, { message: 'Provide student ID, UUID, email, or phone' });

export type InviteStudentByPrincipalDto = z.infer<typeof inviteStudentByPrincipalSchema>;

export const createStudentByParentSchema = z.object({
  firstName:       z.string().min(1, 'First name is required').max(50),
  lastName:        z.string().min(1, 'Last name is required').max(50),
  password:        z.string().min(8, 'Password must be at least 8 characters'),
  customStudentId: z.string().min(3).max(20).regex(/^[a-z0-9]+$/, 'Only lowercase letters and numbers').optional(),
  grade:           z.enum(GRADE_LIST).optional(),
  notes:           z.string().max(2000).optional(),
});

export type CreateStudentByParentDto = z.infer<typeof createStudentByParentSchema>;
