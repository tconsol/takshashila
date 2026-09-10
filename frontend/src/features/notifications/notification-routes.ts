import type { INotification } from './notification.types';

/**
 * Where clicking a notification should land.
 *
 * The destination depends on the *reader's* role — a cancelled class means
 * `/dashboard/tutor/classes` for a tutor and `/dashboard/student/classes` for a
 * student — so the route is resolved here rather than baked in server-side.
 */

type Section = 'classes' | 'assignments' | 'worksheets' | 'wallet' | 'attendance' | 'demo-requests' | 'profile';

const ROLE_SECTIONS: Record<string, Partial<Record<Section, string>>> = {
  STUDENT: {
    classes: '/dashboard/student/classes',
    assignments: '/dashboard/student/worksheets',
    worksheets: '/dashboard/student/worksheets',
    attendance: '/dashboard/student/classes',
    profile: '/profile',
  },
  TUTOR: {
    classes: '/dashboard/tutor/classes',
    assignments: '/dashboard/tutor/assignments',
    worksheets: '/dashboard/tutor/worksheets',
    wallet: '/dashboard/tutor/wallet',
    attendance: '/dashboard/tutor/attendance',
    'demo-requests': '/dashboard/tutor/demo-requests',
    profile: '/profile',
  },
  PRINCIPAL: {
    classes: '/dashboard/principal/classes',
    assignments: '/dashboard/principal/teach/assignments',
    worksheets: '/dashboard/principal/teach/worksheets',
    wallet: '/dashboard/principal/wallet',
    attendance: '/dashboard/principal/teach/attendance',
    profile: '/profile',
  },
  PARENT: {
    classes: '/dashboard/parent/classes',
    assignments: '/dashboard/parent/assignments',
    worksheets: '/dashboard/parent/worksheets',
    attendance: '/dashboard/parent/attendance',
    profile: '/profile',
  },
  ADMIN: { classes: '/dashboard/admin/classes', wallet: '/dashboard/admin/finance', profile: '/profile' },
  SUPER_ADMIN: { classes: '/dashboard/super-admin/classes', wallet: '/dashboard/super-admin/finance', profile: '/profile' },
  SUPPORT: { profile: '/profile' },
};

const TYPE_SECTIONS: Record<string, Section> = {
  CLASS_BOOKED: 'classes',
  CLASS_STARTED: 'classes',
  CLASS_COMPLETED: 'classes',
  CLASS_CANCELLED: 'classes',
  CLASS_REMINDER: 'classes',
  DEMO_ACCEPTED: 'classes',
  DEMO_REJECTED: 'classes',
  DEMO_REQUESTED: 'demo-requests',
  ASSIGNMENT_PUBLISHED: 'assignments',
  ASSIGNMENT_GRADED: 'assignments',
  ASSIGNMENT_DUE_SOON: 'assignments',
  ATTENDANCE_MARKED: 'attendance',
  WALLET_CREDITED: 'wallet',
  WALLET_DEBITED: 'wallet',
  PAYMENT_RECEIVED: 'wallet',
  STUDENT_APPROVED: 'profile',
  TUTOR_APPROVED: 'profile',
  PRINCIPAL_APPROVED: 'profile',
};

export function notificationLink(notification: INotification, role: string | undefined): string | null {
  // An explicit link from the server always wins.
  const explicit = notification.data?.link;
  if (typeof explicit === 'string' && explicit.startsWith('/')) return explicit;

  // Only tutors have a class-detail route; everyone else lands on their list.
  const classPublicId = notification.data?.classPublicId;
  if (role === 'TUTOR' && typeof classPublicId === 'string' && classPublicId) {
    return `/dashboard/tutor/classes/${classPublicId}`;
  }

  if (notification.type === 'SUPPORT_TICKET_UPDATED') {
    return role === 'SUPPORT' ? '/dashboard/support/tickets' : '/dashboard/admin/support';
  }

  const section = TYPE_SECTIONS[notification.type];
  if (!section || !role) return null;
  return ROLE_SECTIONS[role]?.[section] ?? null;
}
