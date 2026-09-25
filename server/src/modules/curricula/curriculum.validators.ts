import { z } from 'zod';
import { GRADE_LIST } from '../students/student.validators';
import { districtIdSchema } from '../geo/geo.validators';
import { normalizeSubject } from '../../utils/taxonomy';

const topicInputSchema = z.object({
  publicId: z.string().optional(), // present when editing an existing topic
  title: z.string().min(1).max(200),
  order: z.number().int().min(0),
});

/** Location is never accepted from clients: the service derives state/county/district
 *  names from `districtId`, and Zod strips any other location keys sent. */
const curriculumBaseSchema = z.object({
  districtId: districtIdSchema,
  grade: z.enum(GRADE_LIST),
  // Same canonical spelling as tutor subjects, so the tutor picker can match them.
  subject: z.string().min(1).max(100).transform(normalizeSubject),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  topics: z.array(topicInputSchema).default([]),
});

export const createCurriculumSchema = curriculumBaseSchema;

export const updateCurriculumSchema = curriculumBaseSchema.partial();

export const curriculumAdminQuerySchema = z.object({
  state: z.string().optional(),
  countyFips: z.string().optional(),
  districtId: z.string().optional(),
  grade: z.string().optional(),
  subject: z.string().optional(),
  isPublished: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/** Student catalog: always district-scoped; no grade = "All grades". */
export const curriculumCatalogQuerySchema = z.object({
  districtId: districtIdSchema,
  grade: z.enum(GRADE_LIST).optional(),
  subject: z.string().optional(),
});

export type CreateCurriculumDto = z.infer<typeof createCurriculumSchema>;
export type UpdateCurriculumDto = z.infer<typeof updateCurriculumSchema>;
export type CurriculumAdminQueryDto = z.infer<typeof curriculumAdminQuerySchema>;
export type CurriculumCatalogQueryDto = z.infer<typeof curriculumCatalogQuerySchema>;

// ─── Admin curriculum materials (curriculum-materials spec §5.3) ───────────────
const topicIds = z.array(z.string().min(1)).min(1, 'Pick at least one topic');
const fileFields = {
  isFileAttachment: z.boolean().optional(),
  filePublicId: z.string().min(1).optional(),
  fileMimeType: z.string().optional(),
  fileOriginalName: z.string().optional(),
};

export const adminResourceSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  mediaPublicId: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  topicPublicIds: topicIds,
});

export const adminAssignmentSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  dueDate: z.string().datetime().optional(),
  maxScore: z.number().int().min(1).max(1000).optional(),
  attachmentPublicIds: z.array(z.string()).optional(),
  ...fileFields,
  topicPublicIds: topicIds,
});

const questionSchema = z.object({
  questionText: z.string().min(1).max(2000),
  options: z.array(z.string().max(500)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().max(2000).optional(),
});

export const adminWorksheetSchema = z.object({
  title: z.string().min(1).max(200),
  subject: z.string().max(100).optional(),
  type: z.enum(['WORKSHEET', 'ASSIGNMENT']),
  dueDate: z.string().datetime().optional(),
  questions: z.array(questionSchema).optional(),
  ...fileFields,
  topicPublicIds: topicIds,
});
