export const PrincipalStatus = {
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  INACTIVE: 'INACTIVE',
} as const;
export type PrincipalStatus = (typeof PrincipalStatus)[keyof typeof PrincipalStatus];

export interface IPrincipalProfile {
  _id: string;
  publicId: string;
  userPublicId: string;
  status: PrincipalStatus;
  organizationName?: string;
  organizationWebsite?: string;
  bio?: string;
  commissionRatePercent: number;
  totalTutors: number;
  totalStudents: number;
  totalRevenueCents: number;
  trustScore: number;
  approvedBy?: string;
  approvedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}
