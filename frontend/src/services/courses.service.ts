// frontend/src/services/courses.service.ts
import { api } from '../lib/axios';

export interface CourseTopic {
  publicId: string;
  title: string;
  order: number;
  resourceIds: string[];
  assignmentIds: string[];
  worksheetIds: string[];
}

export interface Course {
  publicId: string;
  country: string;
  state: string;
  countyFips: string;
  county: string; // display name, derived server-side from countyFips
  districtId?: string; // absent on courses not yet migrated to a district
  district?: string;
  grade: string;
  subject: string;
  title: string;
  description?: string;
  topics: CourseTopic[];
  isPublished: boolean;
  createdAt: string;
}

export interface CreateCourseDto {
  districtId: string;
  grade: string;
  subject: string;
  title: string;
  description?: string;
  topics: Omit<CourseTopic, 'publicId'>[] & { publicId?: string }[];
}

/** A tutor a student can request this course from (GET /courses/:id/tutors). */
export interface CourseTutor {
  publicId: string;
  displayName: string;
  rating: number;
  ratingCount: number;
  hourlyRateCents: number;
  bio?: string;
  isVerified: boolean;
}

export interface PaginatedCourses {
  items: Course[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const coursesService = {
  listCatalog: (params: { districtId?: string; grade?: string; subject?: string }): Promise<Course[]> =>
    api.get('/courses', { params }).then((r) => r.data.data),

  listForAdmin: (params: Record<string, string>): Promise<PaginatedCourses> =>
    api.get('/courses', { params }).then((r) => r.data.data),

  getByPublicId: (coursePublicId: string): Promise<Course> =>
    api.get(`/courses/${coursePublicId}`).then((r) => r.data.data),

  listTutors: (coursePublicId: string): Promise<CourseTutor[]> =>
    api.get(`/courses/${coursePublicId}/tutors`).then((r) => r.data.data),

  create: (dto: CreateCourseDto): Promise<Course> =>
    api.post('/courses', dto).then((r) => r.data.data),

  update: (coursePublicId: string, dto: Partial<CreateCourseDto>): Promise<Course> =>
    api.put(`/courses/${coursePublicId}`, dto).then((r) => r.data.data),

  remove: (coursePublicId: string): Promise<void> =>
    api.delete(`/courses/${coursePublicId}`).then(() => undefined),

  publish: (coursePublicId: string): Promise<Course> =>
    api.post(`/courses/${coursePublicId}/publish`).then((r) => r.data.data),

  unpublish: (coursePublicId: string): Promise<Course> =>
    api.post(`/courses/${coursePublicId}/unpublish`).then((r) => r.data.data),
};
