import { api } from '../lib/axios';

export interface ParentProfile {
  publicId: string;
  userPublicId: string;
  childStudentPublicIds: string[];
  createdAt: string;
}

export interface ChildStudent {
  publicId: string;
  userPublicId: string;
  tutorPublicId: string;
  status: string;
  grade?: string;
  firstName: string;
  lastName: string;
  totalClassesAttended: number;
  totalClassesMissed: number;
  attendanceRate: number;
  createdAt: string;
}

export interface ChildClass {
  publicId: string;
  tutorPublicId: string;
  studentPublicId: string;
  title: string;
  subject?: string;
  status: string;
  classType: string;
  startUTC: string;
  endUTC: string;
  costCents: number;
  meetingUrl?: string;
}

export interface ChildAttendance {
  publicId: string;
  classPublicId: string;
  studentPublicId: string;
  status: string;
  durationPresentMinutes: number;
  remarks?: string;
  createdAt: string;
}

export interface ChildAssignment {
  publicId: string;
  title: string;
  description: string;
  dueDate: string;
  maxScore: number;
  status: string;
  submission: {
    publicId: string;
    status: string;
    score?: number;
    feedback?: string;
    submittedAt?: string;
  } | null;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateChildDto {
  firstName: string;
  lastName: string;
  password: string;
  customStudentId?: string;
  grade?: string;
  notes?: string;
}

export interface CreatedChild extends ChildStudent {
  studentId: string;
}

export interface ActivePrincipal {
  publicId: string;
  userPublicId: string;
  organizationName: string;
  firstName: string;
  lastName: string;
  totalTutors: number;
  totalStudents: number;
}

export interface TutorForParent {
  publicId: string;
  userPublicId: string;
  displayName: string;
  email: string;
  subjects: string[];
  languages: string[];
  hourlyRateCents: number;
  rating: number;
  isVerified: boolean;
  status: string;
}

export const parentService = {
  getProfile: () =>
    api.get('/parents/me').then((r) => r.data.data as ParentProfile),

  getChildren: () =>
    api.get('/parents/me/children').then((r) => (r.data.data ?? []) as ChildStudent[]),

  createChild: (dto: CreateChildDto) =>
    api.post('/parents/me/children/create', dto).then((r) => r.data.data as CreatedChild),

  linkChild: (studentPublicId: string) =>
    api.post('/parents/me/children/link', { studentPublicId }).then((r) => r.data.data as ParentProfile),

  requestLinkChild: (studentPublicId: string) =>
    api.post('/parents/me/children/request', { studentPublicId }).then(() => null),

  updateChild: (studentPublicId: string, dto: { firstName?: string; lastName?: string; grade?: string }) =>
    api.patch(`/parents/me/children/${studentPublicId}`, dto).then(() => null),

  unlinkChild: (studentPublicId: string) =>
    api.delete(`/parents/me/children/${studentPublicId}`).then((r) => r.data.data as ParentProfile),

  getChildClasses: (studentPublicId: string, params?: Record<string, string>) =>
    api.get(`/parents/me/children/${studentPublicId}/classes`, { params })
      .then((r) => r.data.data as PaginatedResult<ChildClass>),

  getChildAttendance: (studentPublicId: string, params?: Record<string, string>) =>
    api.get(`/parents/me/children/${studentPublicId}/attendance`, { params })
      .then((r) => r.data.data as PaginatedResult<ChildAttendance>),

  getChildAssignments: (studentPublicId: string) =>
    api.get(`/parents/me/children/${studentPublicId}/assignments`)
      .then((r) => (r.data.data ?? []) as ChildAssignment[]),

  getChildWorksheets: (studentPublicId: string, params?: Record<string, string>) =>
    api.get(`/parents/me/children/${studentPublicId}/worksheets`, { params })
      .then((r) => r.data.data as PaginatedResult<import('./worksheets.service').Worksheet>),

  requestTutor: (studentPublicId: string, tutorPublicId: string) =>
    api.post(`/parents/me/children/${studentPublicId}/request-tutor`, { tutorPublicId }).then(() => null),

  listActivePrincipals: (params?: Record<string, string>) =>
    api.get('/principals/active', { params }).then((r) => r.data.data as PaginatedResult<ActivePrincipal>),

  getTutorsByPrincipal: (profilePublicId: string, params?: Record<string, string>) =>
    api.get(`/tutors/parent/by-principal/${profilePublicId}`, { params })
      .then((r) => r.data.data as PaginatedResult<TutorForParent>),

  searchTutors: (params?: Record<string, string>) =>
    api.get('/tutors/search', { params }).then((r) => r.data.data as PaginatedResult<TutorForParent>),
};
