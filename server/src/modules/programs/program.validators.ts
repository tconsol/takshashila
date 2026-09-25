// server/src/modules/programs/program.validators.ts
import { z } from 'zod';
import { ProgramCategory, ProgramLevel } from './program.types';

const moduleInput = z.object({
  publicId: z.string().min(1).optional(), // present when editing an existing module
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

const programFields = {
  title: z.string().min(1).max(120),
  category: z.enum(Object.values(ProgramCategory) as [string, ...string[]]),
  description: z.string().max(4000).optional(),
  level: z.enum(Object.values(ProgramLevel) as [string, ...string[]]),
  ageMin: z.number().int().min(3).max(99).optional(),
  ageMax: z.number().int().min(3).max(99).optional(),
  sessionCount: z.number().int().min(1).max(100),
  sessionMinutes: z.number().int().min(15).max(240).default(60),
  priceCents: z.number().int().min(0),
  maxEnrollees: z.number().int().min(1).optional(),
  modules: z.array(moduleInput).min(1, 'Add at least one module'),
};

const ageOrder = (d: { ageMin?: number; ageMax?: number }) => d.ageMin === undefined || d.ageMax === undefined || d.ageMin <= d.ageMax;
const AGE_MSG = { message: 'Minimum age must not exceed maximum age', path: ['ageMax'] };

export const createProgramSchema = z.object(programFields).refine(ageOrder, AGE_MSG);
export const updateProgramSchema = z
  .object({ ...programFields, sessionMinutes: z.number().int().min(15).max(240) })
  .partial()
  .refine(ageOrder, AGE_MSG);

export const programCatalogQuerySchema = z.object({
  category: z.enum(Object.values(ProgramCategory) as [string, ...string[]]).optional(),
  level: z.enum(Object.values(ProgramLevel) as [string, ...string[]]).optional(),
  age: z.coerce.number().int().min(3).max(99).optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const enrollSchema = z.object({
  availabilityWindow: z.object({
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
    startLocalTime: z.string().regex(/^\d{2}:\d{2}$/),
    endLocalTime: z.string().regex(/^\d{2}:\d{2}$/),
    ianaTimezone: z.string().min(1),
  }),
});

export const scheduleSessionSchema = z.object({
  startUTC: z.string().datetime(),
  endUTC: z.string().datetime(),
  title: z.string().min(1).max(200),
  programModulePublicId: z.string().min(1, 'Select the module this session covers'),
});

export type CreateProgramDto = z.infer<typeof createProgramSchema>;
export type UpdateProgramDto = z.infer<typeof updateProgramSchema>;
export type ProgramCatalogQuery = z.infer<typeof programCatalogQuerySchema>;
export type EnrollDto = z.infer<typeof enrollSchema>;
export type ScheduleSessionDto = z.infer<typeof scheduleSessionSchema>;
