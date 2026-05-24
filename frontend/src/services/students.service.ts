import { api } from '../lib/axios';

export interface StudentProfile {
  publicId: string;
  userPublicId: string;
  tutorPublicId?: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  email?: string;
  status: string;
  grade?: string;
  notes?: string;
  subjects?: string[];
  demoClassesUsed: number;
  totalClassesAttended: number;
  totalClassesMissed: number;
  totalClassesBooked?: number;
  attendanceRate: number;
  createdAt: string;
}

export interface StudentLookupResult {
  publicId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  alreadyLinked: boolean;
}

export interface CreateStudentDto {
  firstName: string;
  lastName: string;
  contactEmail?: string;
  phone?: string;
  password: string;
  customStudentId?: string;
  grade?: string;
  notes?: string;
}

export interface CreateStudentByPrincipalDto {
  firstName: string;
  lastName: string;
  contactEmail?: string;
  phone?: string;
  password: string;
  tutorPublicId: string;
  customStudentId?: string;
  grade?: string;
  notes?: string;
}

export interface InviteStudentByPrincipalDto {
  studentId?: string;
  studentPublicId?: string;
  email?: string;
  phone?: string;
  tutorPublicId: string;
}

export interface ParentChildResult {
  publicId: string;
  firstName: string;
  lastName: string;
  grade?: string;
  status: string;
  studentId?: string;
  alreadyLinked: boolean;
}

export interface ParentSearchResult {
  parentName: string;
  children: ParentChildResult[];
}

export interface CreateStudentByParentDto {
  firstName: string;
  lastName: string;
  password: string;
  customStudentId?: string;
  grade?: string;
  notes?: string;
}

export const studentsService = {
  createStudent: (dto: CreateStudentDto) =>
    api.post<{ data: StudentProfile }>('/students', dto).then((r) => r.data.data),


  getMyProfile: () =>
    api.get<{ data: StudentProfile }>('/students/me').then((r) => r.data.data),

  getByPublicId: (publicId: string) =>
    api.get<{ data: StudentProfile }>(`/students/${publicId}`).then((r) => r.data.data),

  approve: (publicId: string) =>
    api.post<{ data: StudentProfile }>(`/students/${publicId}/approve`).then((r) => r.data.data),

  suspend: (publicId: string, reason: string) =>
    api.post<{ data: StudentProfile }>(`/students/${publicId}/suspend`, { reason }).then((r) => r.data.data),

  listPending: () =>
    api.get<{ data: { items: StudentProfile[] } | StudentProfile[] }>('/students/pending')
      .then((r) => {
        const d = r.data.data;
        return Array.isArray(d) ? d : (d as { items: StudentProfile[] }).items ?? [];
      }),

  listAll: (params?: Record<string, string>) =>
    api.get<{ data: { items: StudentProfile[]; total: number; page: number; limit: number; totalPages: number } }>(
      '/students',
      { params },
    ).then((r) => r.data.data),

  getMyStudentsAsTutor: (params?: Record<string, string>) =>
    api.get<{ data: { items: StudentProfile[]; total: number; page: number; limit: number; totalPages: number } }>(
      '/students/my-students',
      { params },
    ).then((r) => r.data.data),

  lookupStudent: (query: { email?: string; phone?: string }) =>
    api.get<{ data: StudentLookupResult }>('/students/lookup', { params: query }).then((r) => r.data.data),

  inviteExisting: (body: { email?: string; phone?: string }) =>
    api.post<{ data: StudentProfile }>('/students/invite-existing', body).then((r) => r.data.data),

  acceptInvite: () =>
    api.post<{ data: StudentProfile }>('/students/me/accept-invite').then((r) => r.data.data),

  declineInvite: () =>
    api.post('/students/me/decline-invite').then(() => null),

  createStudentByPrincipal: (dto: CreateStudentByPrincipalDto) =>
    api.post<{ data: StudentProfile }>('/students/principal/create', dto).then((r) => r.data.data),

  inviteExistingByPrincipal: (dto: InviteStudentByPrincipalDto) =>
    api.post<{ data: StudentProfile }>('/students/principal/invite', dto).then((r) => r.data.data),

  searchParentByEmail: (email: string) =>
    api.get<{ data: ParentSearchResult }>('/students/principal/search-parent', { params: { email } }).then((r) => r.data.data),

  getMyStudentsAsPrincipal: (params?: Record<string, string>) =>
    api
      .get<{ data: { items: StudentProfile[]; total: number; page: number; limit: number; totalPages: number } }>(
        '/students/principal/my-students',
        { params },
      )
      .then((r) => r.data.data),

  transferStudent: (studentPublicId: string, newTutorPublicId: string) =>
    api
      .post<{ data: StudentProfile }>(`/students/${studentPublicId}/transfer`, { newTutorPublicId })
      .then((r) => r.data.data),

  unlinkStudent: (studentPublicId: string) =>
    api.delete(`/students/${studentPublicId}/unlink`).then(() => null),

  getMyPrincipal: () =>
    api.get<{ data: { publicId: string; organizationName?: string; firstName: string; lastName: string } | null }>('/students/me/principal')
      .then((r) => r.data.data ?? null),
};

