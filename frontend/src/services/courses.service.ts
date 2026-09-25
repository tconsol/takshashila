// frontend/src/services/courses.service.ts
import { api } from '../lib/axios';

export interface AvailabilityWindow {
  daysOfWeek: number[];
  startLocalTime: string;
  endLocalTime: string;
  ianaTimezone: string;
}

export interface Course {
  publicId: string;
  studentPublicId: string;
  tutorPublicId: string;
  curriculumPublicId: string;
  topicPublicIds: string[];
  availabilityWindow: AvailabilityWindow;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';
  classesRequired?: number;
  classesScheduledCount: number;
  classesCompletedCount: number;
  costCentsPerClass?: number;
  rejectionReason?: string;
  createdAt: string;
  studentName?: string;
  tutorName?: string;
  curriculumTitle?: string;
  topicTitles?: string[];
}

export interface CreateCourseDto {
  curriculumPublicId: string;
  topicPublicIds: string[];
  tutorPublicId: string;
  availabilityWindow: AvailabilityWindow;
}

export interface ScheduleCourseClassDto {
  startUTC: string;
  endUTC: string;
  title: string;
  description?: string;
  topicPublicId: string;
}

export interface ProgressClass {
  publicId: string;
  status: string;
  startUTC: string;
  endUTC: string;
}

export interface StructureMaterial {
  kind: 'resource' | 'assignment' | 'worksheet';
  publicId: string;
  title: string;
  authorRole: 'TUTOR' | 'ADMIN';
  authorName: string;
}

export interface StructureTopic {
  publicId: string;
  title: string;
  order: number;
  status?: 'COMPLETED' | 'SCHEDULED' | 'NOT_SCHEDULED';
  nextClass?: ProgressClass;
  classes: ProgressClass[];
  materials: StructureMaterial[];
}

export interface CourseStructure {
  viewerRole: 'STUDENT' | 'PARENT' | 'TUTOR' | 'ADMIN';
  course: { publicId: string; status: Course['status']; classesRequired: number; classesCompletedCount: number; tutorName: string; studentName: string };
  curriculum: { publicId: string; title: string; subject: string; grade: string; district?: string; state?: string };
  topics: StructureTopic[];
  otherClasses: ProgressClass[];
}

export interface PaginatedCourses {
  items: Course[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const coursesService = {
  create: (dto: CreateCourseDto): Promise<Course> =>
    api.post('/courses', dto).then((r) => r.data.data),

  getMine: (params?: Record<string, string>): Promise<PaginatedCourses> =>
    api.get('/courses/mine', { params }).then((r) => r.data.data),

  getStructure: (coursePublicId: string): Promise<CourseStructure> =>
    api.get(`/courses/${coursePublicId}/structure`).then((r) => r.data.data),

  listForParent: (): Promise<Course[]> => api.get('/courses/children').then((r) => r.data.data),

  getIncoming: (params?: Record<string, string>): Promise<PaginatedCourses> =>
    api.get('/courses/incoming', { params }).then((r) => r.data.data),

  accept: (coursePublicId: string, classesRequired: number): Promise<Course> =>
    api.post(`/courses/${coursePublicId}/accept`, { classesRequired }).then((r) => r.data.data),

  reject: (coursePublicId: string, reason: string): Promise<Course> =>
    api.post(`/courses/${coursePublicId}/reject`, { reason }).then((r) => r.data.data),

  scheduleClass: (coursePublicId: string, dto: ScheduleCourseClassDto) =>
    api.post(`/courses/${coursePublicId}/schedule-class`, dto).then((r) => r.data.data),

  cancel: (coursePublicId: string): Promise<Course> =>
    api.post(`/courses/${coursePublicId}/cancel`).then((r) => r.data.data),
};
