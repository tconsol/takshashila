export const CourseRequestStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
} as const;
export type CourseRequestStatus = (typeof CourseRequestStatus)[keyof typeof CourseRequestStatus];

export interface IAvailabilityWindow {
  daysOfWeek: number[]; // 0 (Sun) – 6 (Sat)
  startLocalTime: string; // "16:00"
  endLocalTime: string; // "19:00"
  ianaTimezone: string;
}

export interface ICourseRequest {
  _id: string;
  publicId: string;
  studentPublicId: string;
  tutorPublicId: string;
  coursePublicId: string;
  selectedTopicPublicIds: string[];
  availabilityWindow: IAvailabilityWindow;
  status: CourseRequestStatus;
  classesRequired?: number;
  classesScheduledCount: number;
  classesCompletedCount: number;
  costCentsPerClass?: number;
  totalCostCentsCharged?: number;
  rejectionReason?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
