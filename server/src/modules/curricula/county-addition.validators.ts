import { z } from 'zod';
import { US_STATES } from '../geo/us-states';

const STATE_CODES = US_STATES.map((s) => s.code) as [string, ...string[]];

const grade = z.number().int().min(0).max(12); // 0 = Kindergarten

const fields = {
  countyFips: z.string().regex(/^\d{5}$/, 'Pick a county'),
  district: z.string().max(200).optional(),
  gradeFrom: grade,
  gradeTo: grade,
  category: z.string().trim().min(1).max(100),
  subjectName: z.string().max(200).optional(),
  description: z.string().max(4000).optional(),
  topics: z.array(z.string().max(300)).max(100).optional(),
};

export const createCountyAdditionSchema = z.object({ stateCode: z.enum(STATE_CODES), ...fields })
  .refine((d) => d.gradeTo >= d.gradeFrom, { message: 'The last grade cannot be before the first grade', path: ['gradeTo'] });

export const updateCountyAdditionSchema = z.object(fields).partial()
  .refine((d) => d.gradeFrom === undefined || d.gradeTo === undefined || d.gradeTo >= d.gradeFrom, { message: 'The last grade cannot be before the first grade', path: ['gradeTo'] });

export const countyAdditionAdminQuerySchema = z.object({ stateCode: z.enum(STATE_CODES) });

export const publishAllCountyAdditionsSchema = z.object({
  stateCode: z.enum(STATE_CODES),
  countyFips: z.string().regex(/^\d{5}$/).optional(),
});

export const countyAdditionPublicQuerySchema = z.object({
  stateCode: z.enum(STATE_CODES),
  countyFips: z.string().regex(/^\d{5}$/),
  grade: z.string().optional(),
});
