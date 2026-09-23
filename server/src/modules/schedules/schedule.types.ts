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
 * - COURSE_PREPAID: student already paid the full course-request series up front
 *   (see CourseRequest). On completion the student is NOT charged again — only
 *   the tutor earns (rate − platform fee), same math as STUDENT_REQUESTED. On
 *   cancellation (unlike STUDENT_REQUESTED) the class's cost IS refunded, because
 *   it was already collected.
 */
export const BillingMode = {
  STUDENT_REQUESTED: 'STUDENT_REQUESTED',
  TUTOR_INVITED: 'TUTOR_INVITED',
  COURSE_PREPAID: 'COURSE_PREPAID',
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

/**
 * How a class was closed when nobody closed it. A tutor who ran the class but
 * forgot to press Complete should not lose the session; a class nobody turned
 * up to should not sit open forever.
 */
export const AutoResolution = {
  AUTO_COMPLETED: 'AUTO_COMPLETED',
  AUTO_CANCELLED: 'AUTO_CANCELLED',
} as const;
export type AutoResolution = (typeof AutoResolution)[keyof typeof AutoResolution];

/** Grace period after `endUTC` before the sweep closes a class. */
export const AUTO_RESOLVE_GRACE_MINUTES = 10;

/**
 * How long tutor and student must have been in the room together before the
 * platform will settle a class on its own. Below this the class is held for the
 * tutor to complete or cancel — the money is too ambiguous to move unattended.
 */
export const MIN_SESSION_MINUTES = 30;

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
  costCents: number;
  billingMode: BillingMode;
  idempotencyKey: string;
  studentJoinedAt?: Date;
  tutorJoinedAt?: Date;
  /** When the class actually went LIVE, which is not the scheduled start. */
  startedAt?: Date;
  /**
   * Set by the overdue sweep when a class ran but not long enough to settle
   * automatically. It is then held — indefinitely — until the tutor completes
   * or cancels it. No money moves while this is true.
   */
  needsTutorDecision?: boolean;
  cancellationReason?: string;
  cancelledBy?: string;
  rescheduledFromId?: string;
  /**
   * Set when the grace-period sweep closed this class instead of a person.
   * Kept separate from `status` so the UI can label it "Auto completed" /
   * "Auto cancelled" without inventing new statuses that every switch
   * statement in the codebase would then have to handle.
   */
  autoResolution?: AutoResolution;
  autoResolvedAt?: Date;
  isRefunded?: boolean;
  refundedAt?: Date;
  /** Set only when this class was scheduled against an accepted CourseRequest. */
  courseRequestPublicId?: string;
  coursePublicId?: string;
  courseTopicPublicId?: string;
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
