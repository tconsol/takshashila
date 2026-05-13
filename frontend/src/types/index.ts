export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'PRINCIPAL' | 'TUTOR' | 'STUDENT' | 'SUPPORT' | 'PARENT';

export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface User {
  _id: string;
  publicId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: UserStatus;
  phone?: string;
  avatarUrl?: string;
  timezone: string;
  emailVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: Role;
  phone?: string;
  timezone?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]> | string[];
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type CreditType = 'DEMO_CREDITS' | 'PURCHASED_CREDITS' | 'BONUS_CREDITS' | 'EARNED_CREDITS';
export type TransactionType = 'CREDIT' | 'DEBIT' | 'REFUND' | 'REVERSAL' | 'COMMISSION' | 'PAYOUT';
export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';

export interface Wallet {
  publicId: string;
  ownerPublicId: string;
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

export interface WalletTransaction {
  publicId: string;
  type: TransactionType;
  creditType?: CreditType;
  amountCents: number;
  balanceBeforeCents: number;
  balanceAfterCents: number;
  description: string;
  status: TransactionStatus;
  createdAt: string;
}

export type ClassType = 'DEMO' | 'ONE_ON_ONE' | 'GROUP' | 'RECURRING' | 'RECORDED';
export type ClassStatus = 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'MISSED' | 'CANCELLED' | 'RESCHEDULED' | 'FAILED';

export interface ScheduledClass {
  publicId: string;
  tutorPublicId: string;
  studentPublicId: string;
  classType: ClassType;
  status: ClassStatus;
  startUTC: string;
  endUTC: string;
  ianaTimezone: string;
  durationMinutes: number;
  title: string;
  meetingUrl?: string;
  costCents: number;
}

export interface ActiveSession {
  sessionId: string;
  device: string;
  ip: string;
  createdAt: string;
}
