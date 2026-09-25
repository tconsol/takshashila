// frontend/src/services/curricula.service.ts
import { api } from '../lib/axios';

export interface CurriculumTopic {
  publicId: string;
  title: string;
  order: number;
}

export interface Curriculum {
  publicId: string;
  country: string;
  state: string;
  countyFips: string;
  county: string; // display name, derived server-side from countyFips
  districtId?: string; // absent on curricula not yet migrated to a district
  district?: string;
  grade: string;
  subject: string;
  title: string;
  description?: string;
  topics: CurriculumTopic[];
  isPublished: boolean;
  createdAt: string;
}

export interface CreateCurriculumDto {
  districtId: string;
  grade: string;
  subject: string;
  title: string;
  description?: string;
  topics: Omit<CurriculumTopic, 'publicId'>[] & { publicId?: string }[];
}

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

export interface PaginatedCurricula {
  items: Curriculum[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AttachableCurriculum {
  publicId: string; title: string; subject: string; grade: string; district?: string; state: string;
  topics: { publicId: string; title: string; order: number }[];
}

export const curriculaService = {
  listAttachable: (): Promise<AttachableCurriculum[]> => api.get('/curricula/attachable').then((r) => r.data.data),

  listCatalog: (params: { districtId?: string; grade?: string; subject?: string }): Promise<Curriculum[]> =>
    api.get('/curricula', { params }).then((r) => r.data.data),

  listForAdmin: (params: Record<string, string>): Promise<PaginatedCurricula> =>
    api.get('/curricula', { params }).then((r) => r.data.data),

  getByPublicId: (curriculumPublicId: string): Promise<Curriculum> =>
    api.get(`/curricula/${curriculumPublicId}`).then((r) => r.data.data),

  listTutors: (curriculumPublicId: string): Promise<CurriculumTutor[]> =>
    api.get(`/curricula/${curriculumPublicId}/tutors`).then((r) => r.data.data),

  create: (dto: CreateCurriculumDto): Promise<Curriculum> =>
    api.post('/curricula', dto).then((r) => r.data.data),

  update: (curriculumPublicId: string, dto: Partial<CreateCurriculumDto>): Promise<Curriculum> =>
    api.put(`/curricula/${curriculumPublicId}`, dto).then((r) => r.data.data),

  remove: (curriculumPublicId: string): Promise<void> =>
    api.delete(`/curricula/${curriculumPublicId}`).then(() => undefined),

  publish: (curriculumPublicId: string): Promise<Curriculum> =>
    api.post(`/curricula/${curriculumPublicId}/publish`).then((r) => r.data.data),

  unpublish: (curriculumPublicId: string): Promise<Curriculum> =>
    api.post(`/curricula/${curriculumPublicId}/unpublish`).then((r) => r.data.data),
};
