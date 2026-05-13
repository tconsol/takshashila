import { api } from '../lib/axios';

export interface Worksheet {
  publicId: string;
  tutorPublicId: string;
  title: string;
  description: string;
  content: string;
  fileUrl?: string;
  subject?: string;
  sharedWithStudentPublicIds: string[];
  status: 'DRAFT' | 'PUBLISHED';
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorksheetDto {
  title: string;
  description: string;
  content: string;
  fileUrl?: string;
  subject?: string;
  sharedWithStudentPublicIds?: string[];
}

export interface UpdateWorksheetDto {
  title?: string;
  description?: string;
  content?: string;
  fileUrl?: string;
  subject?: string;
  sharedWithStudentPublicIds?: string[];
}

export interface PaginatedWorksheets {
  items: Worksheet[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const worksheetsService = {
  create: (dto: CreateWorksheetDto) =>
    api.post('/worksheets', dto).then((r) => r.data.data as Worksheet),

  getMyAsTutor: (params?: Record<string, string>) =>
    api.get('/worksheets/my', { params }).then((r) => r.data.data as PaginatedWorksheets),

  getMyAsStudent: (params?: Record<string, string>) =>
    api.get('/worksheets/student/me', { params }).then((r) => r.data.data as PaginatedWorksheets),

  getById: (id: string) =>
    api.get(`/worksheets/${id}`).then((r) => r.data.data as Worksheet),

  update: (id: string, dto: UpdateWorksheetDto) =>
    api.patch(`/worksheets/${id}`, dto).then((r) => r.data.data as Worksheet),

  publish: (id: string) =>
    api.post(`/worksheets/${id}/publish`).then((r) => r.data.data as Worksheet),

  unpublish: (id: string) =>
    api.post(`/worksheets/${id}/unpublish`).then((r) => r.data.data as Worksheet),

  shareWithStudents: (id: string, studentPublicIds: string[]) =>
    api.post(`/worksheets/${id}/share`, { studentPublicIds }).then((r) => r.data.data as Worksheet),

  delete: (id: string) =>
    api.delete(`/worksheets/${id}`),
};
