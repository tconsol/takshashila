export const ClassType = {
  DEMO: 'DEMO',
  ONE_ON_ONE: 'ONE_ON_ONE',
  GROUP: 'GROUP',
  RECURRING: 'RECURRING',
  RECORDED: 'RECORDED',
} as const;
export type ClassType = (typeof ClassType)[keyof typeof ClassType];

/**
 * How a class is billed on completion:
 * - STUDENT_REQUESTED: student booked the tutor. Student pays (rate + platform fee),
 *   tutor earns (rate − platform fee). Platform keeps a fee from both sides.
 * - TUTOR_INVITED: tutor created the class and invited students. Students attend free;
 *   the tutor pays the platform fee (both sides) and earns nothing.
 */
export const BillingMode = {
  STUDENT_REQUESTED: 'STUDENT_REQUESTED',
  TUTOR_INVITED: 'TUTOR_INVITED',
} as const;
export type BillingMode = (typeof BillingMode)[keyof typeof BillingMode];

export const ClassStatus = {
  SCHEDULED: 'SCHEDULED',
  LIVE: 'LIVE',
  COMPLETED: 'COMPLETED',
  MISSED: 'MISSED',
  CANCELLED: 'CANCELLED',
  RESCHEDULED: 'RESCHEDULED',
  FAILED: 'FAILED',
} as const;
export type ClassStatus = (typeof ClassStatus)[keyof typeof ClassStatus];

export const AvailabilityStatus = {
  AVAILABLE: 'AVAILABLE',
  BOOKED: 'BOOKED',
  BLOCKED: 'BLOCKED',
  CANCELLED: 'CANCELLED',
} as const;
export type AvailabilityStatus = (typeof AvailabilityStatus)[keyof typeof AvailabilityStatus];

export interface IAvailabilitySlot {
  _id: string;
  publicId: string;
  tutorPublicId: string;
  startUTC: Date;
  endUTC: Date;
  ianaTimezone: string;
  durationMinutes: number;
  status: AvailabilityStatus;
  isRecurring: boolean;
  recurringRuleId?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IScheduledClass {
  _id: string;
  publicId: string;
  tutorPublicId: string;
  studentPublicId: string;
  availabilitySlotPublicId?: string;
  classType: ClassType;
  status: ClassStatus;
  startUTC: Date;
  endUTC: Date;
  ianaTimezone: string;
  durationMinutes: number;
  title: string;
  description?: string;
  meetingUrl?: string;
  meetingProvider?: 'zoom' | 'google_meet' | 'native';
  meetingId?: string;
  recordingUrl?: string;
  recordingGcsKey?: string;
  costCents: number;
  billingMode: BillingMode;
  idempotencyKey: string;
  studentJoinedAt?: Date;
  cancellationReason?: string;
  cancelledBy?: string;
  rescheduledFromId?: string;
  isRefunded?: boolean;
  refundedAt?: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAvailabilityDto {
  tutorPublicId: string;
  startUTC: Date;
  endUTC: Date;
  ianaTimezone: string;
  isRecurring?: boolean;
}

export interface BookClassDto {
  tutorPublicId: string;
  studentPublicId: string;
  availabilitySlotPublicId: string;
  classType: ClassType;
  title: string;
  idempotencyKey: string;
}
