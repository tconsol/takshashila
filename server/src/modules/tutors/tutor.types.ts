export const TutorStatus = {
  INVITED: 'INVITED',
  REGISTERED: 'REGISTERED',
  UNDER_VERIFICATION: 'UNDER_VERIFICATION',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  INACTIVE: 'INACTIVE',
} as const;
export type TutorStatus = (typeof TutorStatus)[keyof typeof TutorStatus];

export interface ITutorProfile {
  _id: string;
  publicId: string;
  userPublicId: string;
  principalPublicId?: string;
  status: TutorStatus;
  subjects: string[];
  gradesTaught?: string[];
  languages: string[];
  hourlyRateCents: number;
  commissionRatePercent: number;
  bio?: string;
  qualifications: string[];
  timezone: string;
  trustScore: number;
  totalStudents: number;
  totalClassesCompleted: number;
  totalClassesCancelled: number;
  totalEarningsCents: number;
  rating: number;
  ratingCount: number;
  isVerified: boolean;
  verifiedAt?: Date;
  verifiedBy?: string;
  invitedBy?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * What an anonymous visitor may see about a tutor. This is an allow-list on purpose:
 * the public directory must never carry earnings, commission, trust score, internal
 * user/organization IDs or who verified or invited the tutor. Add a field here only
 * if the tutor card genuinely shows it.
 */
export interface PublicTutorCard {
  publicId: string;
  displayName: string;
  status: TutorStatus;
  subjects: string[];
  gradesTaught?: string[];
  languages: string[];
  hourlyRateCents: number;
  bio?: string;
  qualifications: string[];
  timezone: string;
  rating: number;
  ratingCount: number;
  totalStudents: number;
  totalClassesCompleted: number;
  isVerified: boolean;
}

export interface CreateTutorProfileDto {
  userPublicId: string;
  principalPublicId?: string;
  subjects?: string[];
  languages?: string[];
  hourlyRateCents?: number;
  bio?: string;
  qualifications?: string[];
  timezone?: string;
  invitedBy?: string;
}

export interface UpdateTutorProfileDto {
  subjects?: string[];
  languages?: string[];
  hourlyRateCents?: number;
  bio?: string;
  qualifications?: string[];
  timezone?: string;
}

export interface TutorSearchFilters {
  subject?: string;
  language?: string;
  timezone?: string;
  minRating?: number;
  minHourlyRateCents?: number;
  maxHourlyRateCents?: number;
  isVerified?: boolean;
  principalPublicId?: string;
}
