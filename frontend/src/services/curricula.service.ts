// frontend/src/services/curricula.service.ts
import { api } from '../lib/axios';
import type { StructureMaterial } from './courses.service';

export interface CurriculumTopic {
  publicId: string;
  title: string;
  order: number;
}

export interface CurriculumChapter {
  publicId: string;
  title: string;
  order: number;
  topics: CurriculumTopic[];
}

export interface CurriculumSource {
  name: string;
  year?: number;
  url?: string;
}

export interface Curriculum {
  publicId: string;
  country: string;
  stateCode: string; // USPS code: a curriculum belongs to one state
  grade: string; // 'High School' for high school courses
  subject: string;
  title: string;
  description?: string;
  level: 'KINDERGARTEN' | 'GRADE' | 'HIGH_SCHOOL';
  courseName?: string; // high school: the course (e.g. 'Algebra I')
  usualGrade?: string; // high school: lowest grade the course is taken in
  topics: CurriculumTopic[]; // mirrors `chapters` (chapter ids)
  chapters?: CurriculumChapter[];
  source?: CurriculumSource;
  isPublished: boolean;
  createdAt: string;
}

export interface StateCatalog {
  curricula: Curriculum[];
  stateLoaded: boolean;
}

/** Chapters and topics as sent to the server; items with a publicId keep their identity. */
export interface ChapterInput {
  publicId?: string;
  title: string;
  topics: Array<{ publicId?: string; title: string }>;
}

export interface CreateCurriculumDto {
  stateCode: string;
  grade: string;
  subject: string;
  title: string;
  description?: string;
  courseName?: string;
  usualGrade?: string;
  chapters: ChapterInput[];
}

/** The state cannot be changed after creation. */
export type UpdateCurriculumDto = Partial<Omit<CreateCurriculumDto, 'stateCode'>>;

/** A tutor a student can request this curriculum from (GET /curricula/:id/tutors). */
export interface CurriculumTutor {
  publicId: string;
  displayName: string;
  rating: number;
  ratingCount: number;
  hourlyRateCents: number;
  bio?: string;
  isVerified: boolean;
}

export interface AdminStateSummary { stateCode: string; total: number; published: number }

export interface AdminCurriculumSummary {
  publicId: string;
  title: string;
  subject: string;
  grade: string;
  level: Curriculum['level'];
  courseName?: string;
  usualGrade?: string;
  isPublished: boolean;
  chapterCount: number;
  topicCount: number;
}

export interface AttachableCurriculum {
  publicId: string; title: string; subject: string; grade: string; stateCode: string;
  topics: { publicId: string; title: string; order: number }[];
}

export interface CurriculumStructure {
  curriculum: { publicId: string; title: string; subject: string; grade: string; stateCode?: string };
  topics: Array<{ publicId: string; title: string; order: number; materials: StructureMaterial[]; subTopics: CurriculumTopic[] }>;
}

export type MaterialKind = 'resource' | 'assignment' | 'worksheet';

export interface ImportReport {
  stateCode: string;
  kind: 'revised' | 'master';
  created: number; updated: number; unchanged: number; skippedPublished: number;
  chapters: number; topics: number;
  subjectsSkippedNotVerified: string[]; emptySubjects: string[]; emptyChapters: string[];
  missingCitation: string[]; missingSourceUrl: string[]; duplicateSubjects: string[];
  highSchoolCourses: number; highSchoolMerged: string[];
  countyAdditions: number;
  /** Subject names with no standard name; imported as written. */
  unmappedSubjects: string[];
  /** Blocks such as "Grade / Course Emphasis" that are not subjects; skipped. */
  notSubjects: string[];
}

export interface ImportOptions {
  stateCode: string;
  kind: 'revised' | 'master';
  countyOnly: boolean;
  commit: boolean;
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const curriculaService = {
  /** Sends the Word file as the raw body; `commit: false` only previews. */
  importDocx: (file: File, opts: ImportOptions): Promise<{ committed: boolean; report: ImportReport }> =>
    api.post('/curricula/admin/import', file, {
      params: { stateCode: opts.stateCode, kind: opts.kind, countyOnly: opts.countyOnly, commit: opts.commit },
      headers: { 'Content-Type': DOCX_MIME },
      timeout: 120_000,
    }).then((r) => r.data.data),

  addMaterial: (curriculumPublicId: string, kind: MaterialKind, body: Record<string, unknown>) =>
    api.post(`/curricula/${curriculumPublicId}/${kind}s`, body).then((r) => r.data.data),
  deleteMaterial: (curriculumPublicId: string, kind: MaterialKind, materialPublicId: string) =>
    api.delete(`/curricula/${curriculumPublicId}/materials/${kind}/${materialPublicId}`).then(() => undefined),
  getStructure: (id: string): Promise<CurriculumStructure> => api.get(`/curricula/${id}/structure`).then((r) => r.data.data),

  listAttachable: (): Promise<AttachableCurriculum[]> => api.get('/curricula/attachable').then((r) => r.data.data),

  getStateCatalog: (stateCode: string, grade?: string): Promise<StateCatalog> =>
    api.get('/curricula/catalog/state', { params: { stateCode, ...(grade ? { grade } : {}) } }).then((r) => r.data.data),

  adminStates: (): Promise<AdminStateSummary[]> => api.get('/curricula/admin/states').then((r) => r.data.data),

  adminOverview: (stateCode: string): Promise<AdminCurriculumSummary[]> =>
    api.get('/curricula/admin/overview', { params: { stateCode } }).then((r) => r.data.data),

  getByPublicId: (curriculumPublicId: string): Promise<Curriculum> =>
    api.get(`/curricula/${curriculumPublicId}`).then((r) => r.data.data),

  listTutors: (curriculumPublicId: string): Promise<CurriculumTutor[]> =>
    api.get(`/curricula/${curriculumPublicId}/tutors`).then((r) => r.data.data),

  create: (dto: CreateCurriculumDto): Promise<Curriculum> =>
    api.post('/curricula', dto).then((r) => r.data.data),

  update: (curriculumPublicId: string, dto: UpdateCurriculumDto): Promise<Curriculum> =>
    api.put(`/curricula/${curriculumPublicId}`, dto).then((r) => r.data.data),

  remove: (curriculumPublicId: string): Promise<void> =>
    api.delete(`/curricula/${curriculumPublicId}`).then(() => undefined),

  publish: (curriculumPublicId: string): Promise<Curriculum> =>
    api.post(`/curricula/${curriculumPublicId}/publish`).then((r) => r.data.data),

  unpublish: (curriculumPublicId: string): Promise<Curriculum> =>
    api.post(`/curricula/${curriculumPublicId}/unpublish`).then((r) => r.data.data),
};
