import { api } from '../lib/api';

export interface ParentLinkRequest {
  publicId: string;
  parentPublicId: string;
  parentName?: string;
  parentEmail?: string;
  status: string;
  createdAt: string;
}

function pickArr<T>(d: unknown): T[] {
  if (Array.isArray(d)) return d as T[];
  const obj = d as { items?: T[] } | null | undefined;
  return Array.isArray(obj?.items) ? obj!.items! : [];
}

export const parentRequestsService = {
  getMine: (): Promise<ParentLinkRequest[]> =>
    api.get('/students/me/parent-requests').then((r) => pickArr<ParentLinkRequest>(r.data?.data ?? r.data)),

  approve: (requestPublicId: string): Promise<void> =>
    api.post(`/students/me/parent-requests/${requestPublicId}/approve`).then(() => undefined),

  reject: (requestPublicId: string): Promise<void> =>
    api.post(`/students/me/parent-requests/${requestPublicId}/reject`).then(() => undefined),
};
