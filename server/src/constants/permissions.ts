import type { Role } from './roles';

export const Permission = {
  // ─── Platform / Infrastructure ────────────────────────
  MANAGE_PLATFORM: 'MANAGE_PLATFORM',
  VIEW_AUDIT_LOGS: 'VIEW_AUDIT_LOGS',
  MANAGE_FEATURE_FLAGS: 'MANAGE_FEATURE_FLAGS',
  VIEW_ANALYTICS: 'VIEW_ANALYTICS',
  MANAGE_COMMISSIONS: 'MANAGE_COMMISSIONS',

  // ─── Admin Management ────────────────────────────────
  CREATE_ADMIN: 'CREATE_ADMIN',
  MANAGE_ADMINS: 'MANAGE_ADMINS',
  APPROVE_PRINCIPALS: 'APPROVE_PRINCIPALS',
  MANAGE_PRINCIPALS: 'MANAGE_PRINCIPALS',

  // ─── Principal Management ────────────────────────────
  CREATE_TUTOR: 'CREATE_TUTOR',
  MANAGE_TUTORS: 'MANAGE_TUTORS',
  VIEW_TUTOR_ANALYTICS: 'VIEW_TUTOR_ANALYTICS',
  VIEW_TUTOR_REVENUE: 'VIEW_TUTOR_REVENUE',

  // ─── Tutor Operations ────────────────────────────────
  CREATE_STUDENT: 'CREATE_STUDENT',
  MANAGE_STUDENTS: 'MANAGE_STUDENTS',
  SCHEDULE_CLASS: 'SCHEDULE_CLASS',
  CONDUCT_CLASS: 'CONDUCT_CLASS',
  UPLOAD_RECORDING: 'UPLOAD_RECORDING',
  MANAGE_ASSIGNMENTS: 'MANAGE_ASSIGNMENTS',
  GRADE_ASSIGNMENTS: 'GRADE_ASSIGNMENTS',
  MARK_ATTENDANCE: 'MARK_ATTENDANCE',

  // ─── Student Operations ──────────────────────────────
  BOOK_CLASS: 'BOOK_CLASS',
  VIEW_RECORDINGS: 'VIEW_RECORDINGS',
  SUBMIT_ASSIGNMENT: 'SUBMIT_ASSIGNMENT',
  MANAGE_OWN_CREDITS: 'MANAGE_OWN_CREDITS',
  VIEW_OWN_PROGRESS: 'VIEW_OWN_PROGRESS',

  // ─── Wallet / Finance ────────────────────────────────
  VIEW_OWN_WALLET: 'VIEW_OWN_WALLET',
  ADMIN_WALLET: 'ADMIN_WALLET',
  PROCESS_PAYOUT: 'PROCESS_PAYOUT',
  VIEW_FINANCIAL_REPORTS: 'VIEW_FINANCIAL_REPORTS',

  // ─── Support ─────────────────────────────────────────
  MANAGE_TICKETS: 'MANAGE_TICKETS',
  RECOVER_ACCOUNTS: 'RECOVER_ACCOUNTS',
  ESCALATE_TICKETS: 'ESCALATE_TICKETS',

  // ─── Media ───────────────────────────────────────────
  UPLOAD_MEDIA: 'UPLOAD_MEDIA',
  MANAGE_MEDIA: 'MANAGE_MEDIA',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: Object.values(Permission),

  ADMIN: [
    Permission.VIEW_AUDIT_LOGS,
    Permission.VIEW_ANALYTICS,
    Permission.APPROVE_PRINCIPALS,
    Permission.MANAGE_PRINCIPALS,
    Permission.MANAGE_ADMINS,
    Permission.ADMIN_WALLET,
    Permission.PROCESS_PAYOUT,
    Permission.VIEW_FINANCIAL_REPORTS,
    Permission.MANAGE_TICKETS,
    Permission.ESCALATE_TICKETS,
    Permission.MANAGE_TUTORS,
  ],

  PRINCIPAL: [
    Permission.CREATE_TUTOR,
    Permission.MANAGE_TUTORS,
    Permission.VIEW_TUTOR_ANALYTICS,
    Permission.VIEW_TUTOR_REVENUE,
    Permission.VIEW_OWN_WALLET,
    Permission.MANAGE_STUDENTS,
    Permission.VIEW_ANALYTICS,
  ],

  TUTOR: [
    Permission.CREATE_STUDENT,
    Permission.MANAGE_STUDENTS,
    Permission.SCHEDULE_CLASS,
    Permission.CONDUCT_CLASS,
    Permission.UPLOAD_RECORDING,
    Permission.MANAGE_ASSIGNMENTS,
    Permission.GRADE_ASSIGNMENTS,
    Permission.MARK_ATTENDANCE,
    Permission.VIEW_OWN_WALLET,
    Permission.UPLOAD_MEDIA,
  ],

  STUDENT: [
    Permission.BOOK_CLASS,
    Permission.VIEW_RECORDINGS,
    Permission.SUBMIT_ASSIGNMENT,
    Permission.MANAGE_OWN_CREDITS,
    Permission.VIEW_OWN_PROGRESS,
    Permission.VIEW_OWN_WALLET,
  ],

  SUPPORT: [
    Permission.MANAGE_TICKETS,
    Permission.RECOVER_ACCOUNTS,
    Permission.ESCALATE_TICKETS,
    Permission.VIEW_AUDIT_LOGS,
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}
