import type { Role } from '../types';

export const ROLES: Record<Role, Role> = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  PRINCIPAL: 'PRINCIPAL',
  TUTOR: 'TUTOR',
  STUDENT: 'STUDENT',
  SUPPORT: 'SUPPORT',
  PARENT: 'PARENT',
};

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  PRINCIPAL: 'Principal',
  TUTOR: 'Tutor',
  STUDENT: 'Student',
  SUPPORT: 'Support',
  PARENT: 'Parent',
};

export const ROLE_COLORS: Record<Role, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-800',
  ADMIN: 'bg-red-100 text-red-800',
  PRINCIPAL: 'bg-orange-100 text-orange-800',
  TUTOR: 'bg-blue-100 text-blue-800',
  STUDENT: 'bg-green-100 text-green-800',
  SUPPORT: 'bg-gray-100 text-gray-800',
  PARENT: 'bg-rose-100 text-rose-800',
};

export const ROLE_DASHBOARD_PATHS: Record<Role, string> = {
  SUPER_ADMIN: '/dashboard/super-admin',
  ADMIN: '/dashboard/admin',
  PRINCIPAL: '/dashboard/principal',
  TUTOR: '/dashboard/tutor',
  STUDENT: '/dashboard/student',
  SUPPORT: '/dashboard/support',
  PARENT: '/dashboard/parent',
};
