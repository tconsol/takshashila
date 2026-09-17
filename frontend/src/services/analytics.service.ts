import { api } from '../lib/axios';

export interface RoleCount {
  role: string;
  count: number;
}

export interface Revenue30d {
  totalCents: number;
  tutorEarningsCents: number;
  platformCommissionCents: number;
}

export interface AuditEvent {
  publicId: string;
  actorId: string;
  actorRole: string;
  action: string;
  resourceType: string;
  createdAt: string;
}

export interface SuperAdminOverview {
  totalUsers: number;
  totalClasses: number;
  roleDistribution: RoleCount[];
  revenue30d: Revenue30d;
  recentAuditEvents: AuditEvent[];
}

export interface PendingPrincipal {
  publicId: string;
  organizationName: string;
  name: string;
  email: string;
  appliedAt: string;
}

export interface UrgentTicket {
  publicId: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
}

export interface AdminStats {
  pendingApprovals: number;
  activePrincipals: number;
  openTickets: number;
  highPriorityTickets: number;
  payoutsPendingCents: number;
}

export interface AdminOverview {
  stats: AdminStats;
  pendingPrincipalsList: PendingPrincipal[];
  urgentTicketsList: UrgentTicket[];
}

export interface ClassStats {
  completed: number;
  cancelled: number;
  booked: number;
  periodDays: number;
  recentClasses: {
    publicId: string;
    title: string;
    status: string;
    startUTC: string;
    costCents: number;
    durationMinutes: number;
  }[];
}

export interface AssignmentStats {
  published: number;
  submitted: number;
  graded: number;
  periodDays: number;
}

export interface AttendanceStats {
  total: number;
  present: number;
  rate: number;
}

export interface RevenuePoint {
  _id: string;
  totalCents: number;
  count: number;
}

export interface TopTutor {
  tutorPublicId: string;
  name: string;
  avatarUrl?: string;
  subjects: string[];
  rating: number;
  classesCompleted: number;
  revenueCents: number;
}

export const analyticsService = {
  getSuperAdminOverview: (): Promise<SuperAdminOverview> =>
    api.get('/analytics/super-admin/overview').then((r) => r.data),

  getAdminOverview: (): Promise<AdminOverview> =>
    api.get('/analytics/admin/overview').then((r) => r.data),

  getPlatformOverview: () =>
    api.get('/analytics/platform/overview').then((r) => r.data),

  getClassStats: (days = 30): Promise<ClassStats> =>
    api.get(`/analytics/platform/classes?days=${days}`).then((r) => r.data),

  getAssignmentStats: (days = 30): Promise<AssignmentStats> =>
    api.get(`/analytics/platform/assignments?days=${days}`).then((r) => r.data),

  getAttendanceStats: (days = 30): Promise<AttendanceStats> =>
    api.get(`/analytics/platform/attendance?days=${days}`).then((r) => r.data),

  getRevenueSeries: (days = 30): Promise<RevenuePoint[]> =>
    api.get(`/analytics/platform/revenue?days=${days}`).then((r) => r.data),

  getTopTutors: (limit = 8): Promise<TopTutor[]> =>
    api.get(`/analytics/platform/top-tutors?limit=${limit}`).then((r) => r.data),

  getTutorStats: () =>
    api.get('/analytics/tutor/me').then((r) => r.data),

  getStudentStats: () =>
    api.get('/analytics/student/me').then((r) => r.data),

  getPrincipalStats: () =>
    api.get('/analytics/principal/me').then((r) => r.data),
};
