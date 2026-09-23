// frontend/src/services/course-requests.service.ts
import { api } from '../lib/axios';

export interface AvailabilityWindow {
  daysOfWeek: number[];
  startLocalTime: string;
  endLocalTime: string;
  ianaTimezone: string;
}

export interface CourseRequest {
  publicId: string;
  studentPublicId: string;
  tutorPublicId: string;
  coursePublicId: string;
  selectedTopicPublicIds: string[];
  availabilityWindow: AvailabilityWindow;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';
  classesRequired?: number;
  classesScheduledCount: number;
  classesCompletedCount: number;
  costCentsPerClass?: number;
  rejectionReason?: string;
  createdAt: string;
}

export interface CreateCourseRequestDto {
  coursePublicId: string;
  selectedTopicPublicIds: string[];
  tutorPublicId: string;
  availabilityWindow: AvailabilityWindow;
}

export interface ScheduleCourseClassDto {
  startUTC: string;
  endUTC: string;
  title: string;
  description?: string;
  courseTopicPublicId?: string;
}

export interface PaginatedCourseRequests {
  items: CourseRequest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const courseRequestsService = {
  create: (dto: CreateCourseRequestDto): Promise<CourseRequest> =>
    api.post('/course-requests', dto).then((r) => r.data.data),

  getMine: (params?: Record<string, string>): Promise<PaginatedCourseRequests> =>
    api.get('/course-requests/mine', { params }).then((r) => r.data.data),

  getIncoming: (params?: Record<string, string>): Promise<PaginatedCourseRequests> =>
    api.get('/course-requests/incoming', { params }).then((r) => r.data.data),

  accept: (requestPublicId: string, classesRequired: number): Promise<CourseRequest> =>
    api.post(`/course-requests/${requestPublicId}/accept`, { classesRequired }).then((r) => r.data.data),

  reject: (requestPublicId: string, reason: string): Promise<CourseRequest> =>
    api.post(`/course-requests/${requestPublicId}/reject`, { reason }).then((r) => r.data.data),

  scheduleClass: (requestPublicId: string, dto: ScheduleCourseClassDto) =>
    api.post(`/course-requests/${requestPublicId}/schedule-class`, dto).then((r) => r.data.data),

  cancel: (requestPublicId: string): Promise<CourseRequest> =>
    api.post(`/course-requests/${requestPublicId}/cancel`).then((r) => r.data.data),
};
