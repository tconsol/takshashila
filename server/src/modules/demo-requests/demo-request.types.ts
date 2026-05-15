export const DemoRequestStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
} as const;
export type DemoRequestStatus = (typeof DemoRequestStatus)[keyof typeof DemoRequestStatus];

export interface IDemoRequest {
  _id: string;
  publicId: string;
  studentPublicId: string;
  tutorPublicId: string;
  availabilitySlotPublicId: string;
  preferredSubject: string;
  message?: string;
  status: DemoRequestStatus;
  classPublicId?: string;
  rejectionReason?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
