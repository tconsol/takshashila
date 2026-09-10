import { api } from '../lib/axios';

export type ContentKind = 'worksheet' | 'assignment' | 'resource';

export interface ContentItem {
  publicId: string;
  kind: ContentKind;
  title: string;
  tutorPublicId: string;
  tutorName: string;
  createdAt: string;
  isDeleted: boolean;
  detail: string | null;
}

export interface Paginated<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface ContentCounts {
  worksheets: number;
  assignments: number;
  resources: number;
  total: number;
}

export interface EmailFailure {
  to: string;
  subject: string;
  status: string;
  detail?: string;
  createdAt: string;
}

export interface EmailStats {
  periodDays: number;
  total: number;
  accepted: number;
  rejected: number;
  failed: number;
  failureRatePercent: number;
  recentFailures: EmailFailure[];
  /** Spells out that "accepted" is a handoff, not a delivery guarantee. */
  note: string;
}

export interface AdminDemoRequest {
  publicId: string;
  preferredSubject: string;
  message?: string;
  status: string;
  rejectionReason?: string;
  tutorName: string;
  studentName: string;
  createdAt: string;
}

export const oversightService = {
  listContent: (params: { kind?: string; q?: string; includeDeleted?: boolean; page?: number }): Promise<Paginated<ContentItem>> => {
    const search = new URLSearchParams({ page: String(params.page ?? 1), limit: '20' });
    if (params.kind) search.set('kind', params.kind);
    if (params.q && params.q.trim().length >= 2) search.set('q', params.q.trim());
    if (params.includeDeleted) search.set('includeDeleted', 'true');
    return api.get(`/system/content?${search.toString()}`).then((r) => r.data.data);
  },

  contentCounts: (): Promise<ContentCounts> =>
    api.get('/system/content/counts').then((r) => r.data.data),

  removeContent: (kind: ContentKind, publicId: string, reason?: string): Promise<void> =>
    api.delete(`/system/content/${kind}/${publicId}`, { data: { reason } }).then(() => undefined),

  restoreContent: (kind: ContentKind, publicId: string): Promise<void> =>
    api.post(`/system/content/${kind}/${publicId}/restore`).then(() => undefined),

  emailStats: (days = 7): Promise<EmailStats> =>
    api.get(`/system/email/stats?days=${days}`).then((r) => r.data.data),

  demoRequests: (status: string, page = 1): Promise<Paginated<AdminDemoRequest>> => {
    const search = new URLSearchParams({ page: String(page), limit: '20' });
    if (status) search.set('status', status);
    return api.get(`/demo-requests/admin/list?${search.toString()}`).then((r) => r.data.data);
  },

  demoRequestCounts: (): Promise<{ status: string; count: number }[]> =>
    api.get('/demo-requests/admin/counts').then((r) => r.data.data),
};
