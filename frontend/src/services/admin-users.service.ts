import { api } from '../lib/axios';
import { downloadCsv } from '../lib/download';

export interface DirectoryUser {
  publicId: string;
  firstName: string;
  lastName: string;
  email: string;
  studentId?: string;
  role: string;
  status: string;
  phone?: string;
  avatarUrl?: string;
  timezone: string;
  emailVerified: boolean;
  lastLoginAt?: string;
  loginCount: number;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface UserCounts {
  byRole: { role: string; count: number }[];
  byStatus: { status: string; count: number }[];
}

export interface UserActivity {
  classesTotal: number;
  classesCompleted: number;
  classesCancelled: number;
  classesUpcoming: number;
  attendanceRate: number | null;
  ticketsOpened: number;
}

export interface UserWallet {
  balanceCents: number;
  demoCreditsCents: number;
  purchasedCreditsCents: number;
  bonusCreditsCents: number;
  earnedCreditsCents: number;
  totalEarnedCents: number;
  totalSpentCents: number;
  currency: string;
  isLocked: boolean;
}

export interface AuditEntry {
  publicId: string;
  action: string;
  actorId: string;
  actorRole: string;
  resourceType: string;
  createdAt: string;
}

export interface UserDetail {
  user: DirectoryUser;
  profile: Record<string, unknown> | null;
  wallet: UserWallet | null;
  activity: UserActivity;
  recentAudit: AuditEntry[];
}

export interface DirectoryQuery {
  page?: number;
  limit?: number;
  role?: string;
  status?: string;
  q?: string;
  /** Deletion is soft, so deleted accounts can be listed and restored. */
  deleted?: 'exclude' | 'include' | 'only';
}

export interface CreateUserPayload {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone?: string;
  timezone?: string;
  grade?: string;
  organizationName?: string;
}

export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  timezone?: string;
  status?: string;
}

export interface StudentBreakdown {
  total: number;
  withTutor: number;
  withoutTutor: number;
  byStatus: { status: string; count: number }[];
  byGrade: { grade: string; count: number }[];
  avgAttendanceRate: number;
  totalClassesAttended: number;
  totalClassesMissed: number;
  totalClassesBooked: number;
  demoClassesUsed: number;
}

export interface GrowthPoint {
  date: string;
  total: number;
  byRole: Record<string, number>;
}

export interface Growth {
  periodDays: number;
  series: GrowthPoint[];
  currentTotal: number;
  previousTotal: number;
  changePercent: number | null;
}

export const adminUsersService = {
  list: (query: DirectoryQuery): Promise<Paginated<DirectoryUser>> => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.role) params.set('role', query.role);
    if (query.status) params.set('status', query.status);
    if (query.q && query.q.trim().length >= 2) params.set('q', query.q.trim());
    if (query.deleted && query.deleted !== 'exclude') params.set('deleted', query.deleted);
    return api.get(`/users?${params.toString()}`).then((r) => r.data.data);
  },

  create: (payload: CreateUserPayload): Promise<UserDetail> =>
    api.post('/users', payload).then((r) => r.data.data),

  update: (publicId: string, payload: UpdateUserPayload): Promise<DirectoryUser> =>
    api.patch(`/users/${publicId}`, payload).then((r) => r.data.data),

  updateProfile: (publicId: string, patch: Record<string, unknown>): Promise<Record<string, unknown>> =>
    api.patch(`/users/${publicId}/profile`, patch).then((r) => r.data.data),

  remove: (publicId: string, reason?: string): Promise<void> =>
    api.delete(`/users/${publicId}`, { data: { reason } }).then(() => undefined),

  restore: (publicId: string): Promise<UserDetail> =>
    api.post(`/users/${publicId}/restore`).then((r) => r.data.data),

  changeRole: (publicId: string, role: string, reason?: string): Promise<UserDetail> =>
    api.post(`/users/${publicId}/role`, { role, reason }).then((r) => r.data.data),

  exportCsv: (query: DirectoryQuery): Promise<void> => {
    const params = new URLSearchParams({ max: '5000' });
    if (query.role) params.set('role', query.role);
    if (query.status) params.set('status', query.status);
    if (query.q && query.q.trim().length >= 2) params.set('q', query.q.trim());
    if (query.deleted && query.deleted !== 'exclude') params.set('deleted', query.deleted);

    const stamp = new Date().toISOString().slice(0, 10);
    const name = `users-${query.role ? `${query.role.toLowerCase()}-` : ''}${stamp}.csv`;
    return downloadCsv(`/users/export?${params.toString()}`, name);
  },

  counts: (): Promise<UserCounts> =>
    api.get('/users/counts').then((r) => r.data.data),

  detail: (publicId: string): Promise<UserDetail> =>
    api.get(`/users/${publicId}/detail`).then((r) => r.data.data),

  suspend: (publicId: string, reason?: string): Promise<void> =>
    api.post(`/users/${publicId}/suspend`, { reason }).then(() => undefined),

  activate: (publicId: string): Promise<void> =>
    api.post(`/users/${publicId}/activate`).then(() => undefined),

  studentBreakdown: (): Promise<StudentBreakdown> =>
    api.get('/analytics/platform/students').then((r) => r.data),

  growth: (days = 90): Promise<Growth> =>
    api.get(`/analytics/platform/growth?days=${days}`).then((r) => r.data),
};
