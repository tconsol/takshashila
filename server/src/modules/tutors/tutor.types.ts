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
  maxHourlyRateCents?: number;
  isVerified?: boolean;
  principalPublicId?: string;
}
