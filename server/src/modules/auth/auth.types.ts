/**
 * Google sign-in can also be a sign-UP, and Google only tells us who someone is
 * — not what they are on this platform. So the first call for an unknown address
 * comes back asking for a role instead of a session, and the client replays the
 * same Google credential with `role` plus whatever that role needs.
 */

/** Roles a person may self-select. Staff accounts are created by an admin. */
export const GOOGLE_SIGNUP_ROLES = ['STUDENT', 'TUTOR', 'PRINCIPAL'] as const;
export type GoogleSignupRole = (typeof GOOGLE_SIGNUP_ROLES)[number];

export interface GoogleAuthInput {
  idToken?: string;
  code?: string;
  accessToken?: string;

  /** Absent on the first call; present once the person has picked. */
  role?: string;

  phone?: string;
  timezone?: string;
  /** TUTOR */
  subjects?: string[];
  languages?: string[];
  bio?: string;
  qualifications?: string[];
  /** STUDENT */
  grade?: string;
  /** PRINCIPAL */
  organizationName?: string;
}

/** Returned with HTTP 200 — not an error, just an unfinished signup. */
export interface GoogleRoleRequired {
  needsRole: true;
  email: string;
  firstName: string;
  lastName: string;
  picture?: string;
}

export function isRoleRequired<T extends object>(
  result: T | GoogleRoleRequired,
): result is GoogleRoleRequired {
  return (result as GoogleRoleRequired).needsRole === true;
}

/** The slice of a signup payload that role provisioning actually reads. */
export interface RoleProfileInput {
  timezone?: string;
  subjects?: string[];
  languages?: string[];
  bio?: string;
  qualifications?: string[];
  grade?: string;
  organizationName?: string;
}
