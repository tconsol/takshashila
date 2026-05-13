export const Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  PRINCIPAL: 'PRINCIPAL',
  TUTOR: 'TUTOR',
  STUDENT: 'STUDENT',
  SUPPORT: 'SUPPORT',
  PARENT: 'PARENT',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ROLES_LIST = Object.values(Role);

export const ROLE_HIERARCHY: Record<Role, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 80,
  PRINCIPAL: 60,
  TUTOR: 40,
  STUDENT: 20,
  SUPPORT: 30,
  PARENT: 15,
};

export function isHigherRole(a: Role, b: Role): boolean {
  return ROLE_HIERARCHY[a] > ROLE_HIERARCHY[b];
}
