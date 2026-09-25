export const CourseStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
} as const;
export type CourseStatus = (typeof CourseStatus)[keyof typeof CourseStatus];

export interface IAvailabilityWindow {
  daysOfWeek: number[]; // 0 (Sun) – 6 (Sat)
  startLocalTime: string; // "16:00"
  endLocalTime: string; // "19:00"
  ianaTimezone: string;
}

export interface ICourse {
  _id: string;
  publicId: string;
  studentPublicId: string;
  tutorPublicId: string;
  curriculumPublicId: string;
  topicPublicIds: string[];
  availabilityWindow: IAvailabilityWindow;
  status: CourseStatus;
  classesRequired?: number;
  classesScheduledCount: number;
  classesCompletedCount: number;
  costCentsPerClass?: number;
  totalCostCentsCharged?: number;
  rejectionReason?: string;
  acceptedAt?: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
