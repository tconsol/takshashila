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

export const analyticsService = {
  getSuperAdminOverview: (): Promise<SuperAdminOverview> =>
    api.get('/analytics/super-admin/overview').then((r) => r.data),

  getAdminOverview: (): Promise<AdminOverview> =>
    api.get('/analytics/admin/overview').then((r) => r.data),

  getPlatformOverview: () =>
    api.get('/analytics/platform/overview').then((r) => r.data),

  getTutorStats: () =>
    api.get('/analytics/tutor/me').then((r) => r.data),

  getStudentStats: () =>
    api.get('/analytics/student/me').then((r) => r.data),

  getPrincipalStats: () =>
    api.get('/analytics/principal/me').then((r) => r.data),
};
