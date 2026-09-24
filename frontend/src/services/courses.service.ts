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

export interface MaterialRef { publicId: string; title: string }

export interface TopicProgress {
  publicId: string;
  title: string;
  order: number;
  status: 'COMPLETED' | 'SCHEDULED' | 'NOT_SCHEDULED';
  nextClass?: ProgressClass;
  classes: ProgressClass[];
  materials: { resources: MaterialRef[]; assignments: MaterialRef[]; worksheets: MaterialRef[] };
}

export interface CourseProgress {
  course: { publicId: string; status: Course['status']; classesRequired: number; classesCompletedCount: number; tutorName: string };
  curriculum: { publicId: string; title: string; subject: string; grade: string; district?: string; state?: string };
  topics: TopicProgress[];
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

  getProgress: (coursePublicId: string): Promise<CourseProgress> =>
    api.get(`/courses/${coursePublicId}/progress`).then((r) => r.data.data),

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
