import { z } from 'zod';
import { GRADE_LIST } from '../students/student.validators';
import { HIGH_SCHOOL_GRADE } from './curriculum.types';
import { US_STATES } from '../geo/us-states';
import { normalizeSubject } from '../../utils/taxonomy';

const topicInputSchema = z.object({
  publicId: z.string().optional(), // present when editing an existing topic
  title: z.string().trim().min(1).max(300),
  order: z.number().int().min(0).optional(),
});

const chapterInputSchema = z.object({
  publicId: z.string().optional(), // present when editing an existing chapter
  title: z.string().trim().min(1).max(300),
  order: z.number().int().min(0).optional(),
  topics: z.array(topicInputSchema).default([]),
});

const STATE_CODES = US_STATES.map((s) => s.code) as [string, ...string[]];
const CURRICULUM_GRADES = [...GRADE_LIST, HIGH_SCHOOL_GRADE] as [string, ...string[]];

/** A curriculum belongs to a state, a grade (or High School) and a subject; there is no district. */
const curriculumBaseSchema = z.object({
  stateCode: z.enum(STATE_CODES),
  grade: z.enum(CURRICULUM_GRADES),
  // Same canonical spelling as tutor subjects, so the tutor picker can match them.
  subject: z.string().min(1).max(100).transform(normalizeSubject),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  courseName: z.string().max(200).optional(),
  usualGrade: z.string().max(20).optional(),
  chapters: z.array(chapterInputSchema).default([]),
});

export const createCurriculumSchema = curriculumBaseSchema;

/** The state cannot change after creation; everything else can. */
export const updateCurriculumSchema = curriculumBaseSchema.omit({ stateCode: true }).partial();

/** State-based catalog: grade is optional ("All grades"). */
export const curriculumStateCatalogQuerySchema = z.object({
  stateCode: z.enum(STATE_CODES),
  grade: z.enum(GRADE_LIST).optional(),
  subject: z.string().optional(),
});

export const curriculumAdminOverviewQuerySchema = z.object({
  stateCode: z.enum(STATE_CODES),
});

export type CreateCurriculumDto = z.infer<typeof createCurriculumSchema>;
export type UpdateCurriculumDto = z.infer<typeof updateCurriculumSchema>;
export type CurriculumChapterInput = z.infer<typeof chapterInputSchema>;

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
