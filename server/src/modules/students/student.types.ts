export const StudentStatus = {
  INVITED: 'INVITED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
  TRANSFERRED: 'TRANSFERRED',
} as const;
export type StudentStatus = (typeof StudentStatus)[keyof typeof StudentStatus];

export interface IStudentProfile {
  _id: string;
  publicId: string;
  userPublicId: string;
  tutorPublicId?: string;
  previousTutorPublicIds: string[];
  contactEmail?: string;
  status: StudentStatus;
  demoClassesUsed: number;
  demoClassTakenWith: string[];
  totalClassesAttended: number;
  totalClassesMissed: number;
  totalClassesBooked: number;
  attendanceRate: number;
  grade?: string;
  notes?: string;
  invitedBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  transferredFrom?: string;
  transferredAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStudentProfileDto {
  userPublicId: string;
  tutorPublicId: string;
  invitedBy: string;
  grade?: string;
  notes?: string;
}

export interface TransferStudentDto {
  newTutorPublicId: string;
  reason?: string;
}
