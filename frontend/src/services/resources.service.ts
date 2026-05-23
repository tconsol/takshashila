import { api } from '../lib/axios';

export interface Resource {
  publicId: string;
  tutorPublicId: string;
  classPublicId?: string;
  title: string;
  description?: string;
  mediaPublicId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateResourceDto {
  classPublicId?: string;
  title: string;
  description?: string;
  mediaPublicId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface PaginatedResources {
  items: Resource[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const resourcesService = {
  create: (dto: CreateResourceDto) =>
    api.post('/resources', dto).then((r) => r.data.data as Resource),

  getMyAsTutor: (params?: Record<string, string>) =>
    api.get('/resources/my', { params }).then((r) => r.data.data as PaginatedResources),

  getMyAsStudent: (params?: Record<string, string>) =>
    api.get('/resources/student/me', { params }).then((r) => r.data.data as PaginatedResources),

  getById: (id: string) =>
    api.get(`/resources/${id}`).then((r) => r.data.data as Resource),

  getReadUrl: (id: string) =>
    api.get(`/resources/${id}/read-url`).then((r) => (r.data.data as { url: string }).url),

  update: (id: string, dto: { title?: string; description?: string }) =>
    api.patch(`/resources/${id}`, dto).then((r) => r.data.data as Resource),

  delete: (id: string) =>
    api.delete(`/resources/${id}`),
};
