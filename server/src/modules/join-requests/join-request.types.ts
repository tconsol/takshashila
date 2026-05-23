export const JoinRequestStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;
export type JoinRequestStatus = (typeof JoinRequestStatus)[keyof typeof JoinRequestStatus];

export const JoinRequestInitiator = {
  TUTOR: 'TUTOR',
  PRINCIPAL: 'PRINCIPAL',
} as const;
export type JoinRequestInitiator = (typeof JoinRequestInitiator)[keyof typeof JoinRequestInitiator];

export interface IJoinRequest {
  _id: string;
  publicId: string;
  tutorUserPublicId: string;
  tutorProfilePublicId: string;
  principalUserPublicId: string;
  principalProfilePublicId: string;
  initiatedBy: JoinRequestInitiator;
  status: JoinRequestStatus;
  message?: string;
  rejectionReason?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
