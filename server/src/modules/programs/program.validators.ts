// server/src/modules/programs/program.validators.ts
import { z } from 'zod';
import { ProgramCategory, ProgramLevel } from './program.types';
import { PLATFORM_FEE_CENTS } from '../../utils/currency';

/** Free, or at least the platform fee per session (so the tutor never earns 0 on a paid program). */
export const isPriceAllowed = (priceCents: number, sessionCount: number) =>
  priceCents === 0 || priceCents >= sessionCount * PLATFORM_FEE_CENTS;

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

export const createProgramSchema = z.object(programFields).refine(ageOrder, AGE_MSG)
  .refine((d) => isPriceAllowed(d.priceCents, d.sessionCount), {
    message: `Price must be free or at least $${(PLATFORM_FEE_CENTS / 100).toFixed(2)} per session`,
    path: ['priceCents'],
  });
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

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const isTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const enrollSchema = z.object({
  availabilityWindow: z
    .object({
      daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
      startLocalTime: z.string().regex(HHMM, 'Use HH:MM'),
      endLocalTime: z.string().regex(HHMM, 'Use HH:MM'),
      ianaTimezone: z.string().min(1).refine(isTimeZone, 'Unknown timezone'),
    })
    .refine((w) => w.startLocalTime < w.endLocalTime, { message: 'End time must be after start time', path: ['endLocalTime'] }),
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
