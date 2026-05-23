import type { Role } from '../../constants/roles';

export const UserStatus = {
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export interface IUser {
  _id: string;
  publicId: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: UserStatus;
  phone?: string;
  avatarUrl?: string;
  timezone: string;
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpiry?: Date;
  passwordResetToken?: string;
  passwordResetExpiry?: Date;
  twoFAEnabled: boolean;
  twoFASecret?: string;
  lastLoginAt?: Date;
  lastLoginIp?: string;
  loginCount: number;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PublicUser = Omit<
  IUser,
  | 'passwordHash'
  | 'emailVerificationToken'
  | 'emailVerificationExpiry'
  | 'passwordResetToken'
  | 'passwordResetExpiry'
  | 'twoFASecret'
>;

export interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
  phone?: string;
  timezone?: string;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
  timezone?: string;
}
