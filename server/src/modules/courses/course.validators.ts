import { z } from 'zod';
import { GRADE_LIST } from '../students/student.validators';
import { locationShape, refineLocation } from '../geo/geo.validators';

const topicInputSchema = z.object({
  publicId: z.string().optional(), // present when editing an existing topic
  title: z.string().min(1).max(200),
  order: z.number().int().min(0),
  resourceIds: z.array(z.string()).default([]),
  assignmentIds: z.array(z.string()).default([]),
  worksheetIds: z.array(z.string()).default([]),
});

const courseBaseSchema = z.object({
  ...locationShape,
  grade: z.enum(GRADE_LIST),
  subject: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  topics: z.array(topicInputSchema).default([]),
});

export const createCourseSchema = courseBaseSchema.superRefine(refineLocation);

export const updateCourseSchema = courseBaseSchema.partial().superRefine(refineLocation);

export const courseCatalogQuerySchema = z.object({
  state: z.string().optional(),
  countyFips: z.string().optional(),
  grade: z.string().optional(),
  subject: z.string().optional(),
  isPublished: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type CreateCourseDto = z.infer<typeof createCourseSchema>;
export type UpdateCourseDto = z.infer<typeof updateCourseSchema>;
export type CourseCatalogQueryDto = z.infer<typeof courseCatalogQuerySchema>;
